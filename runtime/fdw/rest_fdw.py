import json
import re
import requests
import base64
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode
from multicorn import ColumnDefinition, ForeignDataWrapper
from multicorn.utils import DEBUG, ERROR, WARNING, INFO, log_to_postgres
from jsonpath_ng.ext import parse
import os
from datetime import datetime, timedelta

def _fdw_debug(msg):
    try:
        with open("/tmp/fdw_debug.log", "a") as f:
            f.write(f"[{datetime.now().isoformat()}] {msg}\n")
    except:
        pass


# A FDW that can expose REST APIs as PostgreSQL tables.
# Supports nested JSON structures as ROW and ARRAY types.
class RestForeignDataWrapper(ForeignDataWrapper):
    _startup_cost = 200  # ~milliseconds per salesforce API call

    # Initialize the FDW with the options from the CREATE SERVER and CREATE FOREIGN TABLE statements.
    def __init__(self, options: Dict[str, str], columns: Dict[str, ColumnDefinition]):

        super().__init__(options, columns)
        self.columns = columns

        # Required options
        if "url" not in options:
            log_to_postgres("The url parameter is required", ERROR)
        self.base_url = options["url"]

        # Optional parameters with defaults
        self.method = options.get("select_method", "GET")
        self.insert_method = options.get("insert_method", None)
        self.update_method = options.get("update_method", None)
        self.delete_method = options.get("delete_method", None)
        self.id_column = options.get("id_column", None)
        self.path = options.get("path", "")
        self.byid_path = options.get("byid_path", None)
        self.byid_result_path = options.get("byid_result_path", None)
        self.insert_path = options.get("insert_path", self.path)
        self.result_path = options.get("result_path", None)
        self.headers = json.loads(options.get("headers", "{}"))
        self.params = json.loads(options.get("params", "{}"))
        self.search_fields = json.loads(options.get("search_fields", "[]"))
        self.row_count = int(options.get("row_count", 100))
        self.status_field = options.get("status_field", None)
        self.status_value = options.get("status_value", None)
        self.get_before_update = options.get("get_before_update", "false").lower() == "true"
        self.stub_select = options.get("stub_select", "false").lower() == "true"
        self.limit_parameter = options.get("limit_parameter", None)
        self.offset_parameter = options.get("offset_parameter", None)

        # Sorting options
        self.sort_parameter = options.get("sort_parameter", None)
        self.sort_num_fields = int(options.get("sort_num_fields", 0))
        self.sort_dir_parameter = options.get("sort_dir_parameter", None)
        self.sort_dir_value = options.get("sort_dir_value", "Asc:Desc").split(":")

        # Authentication options, typically passed in by the user mapping
        self.grant_type = options.get("grant_type", None)
        self.client_id = options.get("client_id", None)
        self.client_secret = options.get("client_secret", None)
        self.username = options.get("username", None)
        self.password = options.get("password", None)
        self.login_server = options.get("login_server", None)
        self.auth_token = None
        self.auth_token_expires_at = None

        # Path parameter support
        if self.byid_path:
            self.byid_path_parameters = self._parse_path_parameters(self.byid_path)
        
        # automatically set the id column to the first path parameter if it's not explictly set
        if not self.id_column and self.byid_path:
            self.id_column = self.byid_path_parameters[0]

        # Allow writes option
        self.allow_writes = options.get("allow_writes", "false").lower() == "true"

        # Decode column options
        self.mapping = {}
        self.write_mapping = {}
        self.byid_mapping = {}
        self.column_types = {}
        self.sort_mapping = {}
        # TODO: Parse/compile the json paths here instead of in the _extract_value method
        for column_name, column in self.columns.items():
            self.column_types[column_name] = column.type_name
            if column.options.get("mapping", None):
                self.mapping[column_name] = column.options.get("mapping")
            if column.options.get("write_mapping", None):
                self.write_mapping[column_name] = column.options.get("write_mapping")
            if column.options.get("byid_mapping", None):
                self.byid_mapping[column_name] = column.options.get("byid_mapping")
            
            if column.options.get("sortable", None):
                self.sort_mapping[column_name] = column.options.get("sort_mapping",column_name)


    @classmethod
    def import_schema(cls, schema, srv_options, options, restriction_type, restricts):
        log_to_postgres( f"-> FDW import_schema called with options: {options}, schema: {schema}", INFO )

        # We never actually create the tables
        return []

    # Parse path parameters from the path template
    def _parse_path_parameters(self , path: str):

        # Find all parameters in the format {parameter_name}
        pattern = r"\{([a-zA-Z0-9_]+)\}"
        return re.findall(pattern, path)


    # Set up authentication.
    def _get_headers(self) -> Dict[str, str]:
        headers = self.headers.copy()

        if self.login_server and (not self.auth_token or self.auth_token_expires_at < datetime.now()):
            params = {
                "grant_type": self.grant_type,
                "client_id": self.client_id,
            }

            if self.client_secret:
                params["client_secret"] = self.client_secret

            if self.username and self.password:
                params["username"] = self.username
                params["password"] = self.password

            try:
                response = requests.request(
                    method="POST",
                    url=self.login_server,
                    params=params,
                    timeout=30,
                )
                response.raise_for_status()
                response = response.json()
                self.auth_token = response['access_token']
                if 'expires_in' in response:
                    self.auth_token_expires_at = datetime.now() + timedelta(seconds=response['expires_in'])
                else:
                    self.auth_token_expires_at = datetime.now() + timedelta(seconds=3600) # Default to 1 hour if expires_in is not present
                    
            except requests.RequestException as e:
                log_to_postgres(f"Authentication failed: {str(e)}", ERROR)
                return {}

        headers["Authorization"] = f"Bearer {self.auth_token}"

        return headers


    # Make the request to the REST API with path parameters and query parameters
    def _make_request( self, url: str, params: Dict[str, str], retry: bool = True) -> Dict[str, Any]:

        # Make the request
        try:
            response = requests.request(
                method=self.method,
                url=url,
                headers=self._get_headers(),
                params=params,
                timeout=30,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if response.status_code == 404:
                return []
            if response.status_code == 401 and retry:
                self.auth_token = None
                return self._make_request(url, params, False)
            log_to_postgres(f"REST API request failed: {str(e)}", ERROR)
            return {}


    # Extract the result data from the response.
    def _extract_data(self, json_path: str, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        if json_path and json_path != "":
            value = parse(json_path).find(response_data)
            if len(value) == 0:
                log_to_postgres( f"Result path '{json_path}' not found in response; instead found '{response_data}'", WARNING)
                return []
            else:
                response_data = value[0].value

        # If no result_path specified, assume the response is the data or a list itself
        if isinstance(response_data, list):
            return response_data
        return [response_data]


    # Extract a value from a row using a JSON path and convert to appropriate PostgreSQL type.
    def _extract_value(self, row: Dict[str, Any], json_path: str, column_name: str) -> Any:

        # extract the value from the row using the json path
        if json_path:
            value = parse(json_path).find(row)
            value = None if len(value) == 0 else value[0].value
        else:
            value = row.get(column_name)
       
        # Handle JSON types
        pg_type = self.column_types.get(column_name)
        if pg_type.lower() in ("json", "jsonb"):
            return json.dumps(value)

        # For simple types, just return the value
        return value

    # Extract search parameter values from the quals.
    def _extract_search_param_values(self, quals) -> Dict[str, str]:
        search_param_values = {}

        for qual in quals:
            if qual.field_name in self.search_fields and qual.operator == "=":
                search_param_values[qual.field_name] = qual.value

        return search_param_values


    # Extract path parameter values from the quals.
    def _extract_path_param_values(self, quals) -> Dict[str, str]:
        path_param_values = {}

        url = f"{self.base_url}{self.path}"
        for qual in quals:
            if qual.field_name == self.id_column and qual.operator == "=":
                path_param_values[qual.field_name] = qual.value
                url = f"{self.base_url}{self.byid_path}".replace(f"{{{self.id_column}}}", str(qual.value))

        return url, path_param_values


    # Extract path and search parameter values from the quals.
    def _params_from_quals(self, quals, sortkeys, limit, offset) -> Dict[str, str]:
        url, path_param_values = self._extract_path_param_values(quals)
        param_values = self._extract_search_param_values(quals)
        params = self.params | param_values

        if sortkeys:
            params[self.sort_parameter] = ",".join([self.sort_mapping[sortkey.attname] for sortkey in sortkeys])
            params[self.sort_dir_parameter] = ",".join([(self.sort_dir_value[1 if sortkey.is_reversed else 0]) for sortkey in sortkeys])

        if limit:
            params[self.limit_parameter] = limit
        if offset:
            params[self.offset_parameter] = offset

        return url, params, path_param_values


    def can_limit(self, limit, offset):
        if not self.limit_parameter and limit is not None:
            return False
        if not self.offset_parameter and offset is not None:
            return False
        return True

    def can_sort(self, sortkeys):
        # log_to_postgres(f"Checking if can sort by keys: {sortkeys}", WARNING)
 
        count = 0
        sort_fields = []

        for sortkey in sortkeys:
            if sortkey.attname in self.sort_mapping:
                sort_fields.append(sortkey)
                count += 1
            else:
                break;

            if count >= self.sort_num_fields:   
                break

        # log_to_postgres(f"Sort fields: {sort_fields}", WARNING)   
        return sort_fields

    # Explain the query using the REST API
    def explain(self, quals, columns, sortkeys=None, verbose=False, limit=None, offset=None):

        # Extract parameter values from quals
        url, params, path_params = self._params_from_quals(quals, sortkeys, limit, offset)

        # Build the URL with path parameters and query parameters
        # This is done by python requests library automatically, so we build it manually here
        url_params = urlencode(params)
        if url_params:
            url += f"?{url_params}"

        return [f'rest_fdw: {url}']


    # Extract rows from the results json/dict
    def _extract_rows(self, results: List[Dict[str, Any]], mapping: Dict[str, str], columns: List[str]) -> List[Dict[str, Any]]:
        rows = []
        for row in results:
            row_data = {}
            for column_name in columns:
                if column_name in mapping:
                    json_path = mapping[column_name]
                    row_data[column_name] = self._extract_value(row, json_path, column_name)
                else:
                    row_data[column_name] = self._extract_value(row, None, column_name)
            rows.append(row_data)
        return rows


    # Execute SELECT query using the REST API
    def execute(self, quals, columns, sortkeys=None, limit=None, offset=None):
        log_to_postgres(f"[FDW DEBUG] execute() called, stub_select={self.stub_select}, quals={[(q.field_name, q.operator, q.value) for q in quals] if quals else 'None'}, base_url={self.base_url}, path={self.path}", WARNING)
        
        # Write-only endpoints: return a stub row from quals instead of GET
        if self.stub_select:
            stub = {}
            for qual in quals:
                stub[qual.field_name] = qual.value
            yield stub
            return

        # Extract parameter values from quals
        url, params, path_params = self._params_from_quals(quals, sortkeys, limit, offset)
        if url==f"{self.base_url}{self.path}":
            result_path = self.result_path
            mapping = self.mapping
        else:
            result_path = self.byid_result_path
            mapping = self.byid_mapping

        # Get and convert the results from the REST API
        log_to_postgres(f"Making request to URL: {url} with params: {params}", DEBUG)
        response = self._make_request(url, params)

        if self.status_field and self.status_value and response[self.status_field] != self.status_value:
            log_to_postgres(f"Incorrect status: {self.status_field}: {response.get(self.status_field)}", ERROR)
            return None

        results = self._extract_data(result_path, response)
        rows = self._extract_rows(results, mapping, columns)
 
        # Return the rows, 1-by-1
        # TODO: Left as for loop so we can add pagination support here if needed
        for row in rows:
            yield row

    @property
    def rowid_column(self):
        if self.allow_writes:
            return self.id_column
        else:
            log_to_postgres( "FDW does not allow writes to this object.", ERROR )

    def insert(self, values):
        _fdw_debug(f"insert() called on {self.base_url}{self.path}, insert_method={self.insert_method}, insert_path={getattr(self, 'insert_path', 'N/A')}, keys={list(values.keys()) if values else 'None'}, byid_path={self.byid_path}")
        log_to_postgres(f"[FDW DEBUG] insert() called on {self.base_url}{self.path}, insert_method={self.insert_method}, insert_path={getattr(self, 'insert_path', 'N/A')}, keys={list(values.keys()) if values else 'None'}", WARNING)
        if not self.insert_method:
            _fdw_debug(f"insert() - no insert_method, returning early")
            log_to_postgres("[FDW DEBUG] insert() - no insert_method, returning early", WARNING)
            log_to_postgres("No insert method defined", ERROR)
            return

        url = f"{self.base_url}{self.insert_path}"
        log_to_postgres(f"[FDW DEBUG] insert() url={url}", WARNING)

        # Convert PostgreSQL values to JSON-compatible format
        json_values = self._prepare_values_for_json(values)

        try:
            response = requests.request(
                method=self.insert_method,
                url=url,
                json=json_values,
                headers=self._get_headers(),
                timeout=30,
            )
            response.raise_for_status()

            if self.status_field and self.status_value and response.json()[self.status_field] != self.status_value:
                log_to_postgres(f"Incorrect status: {response.text}", ERROR)
                return None

            results = self._extract_data(self.byid_result_path, response.json())
            rows = self._extract_rows(results, self.mapping, self.columns)
            return rows[0]

        except requests.RequestException as e:
            resp_text = response.text[:2000] if response is not None and response.text else 'N/A'
            _fdw_debug(f"insert() FAILED: {str(e)}, response={resp_text}")
            log_to_postgres(f"REST API insert failed: {str(e)}, response={resp_text}", ERROR)


    # Convert PostgreSQL values to JSON-compatible format.
    def _prepare_values_for_json(self, values):
        json_values = {}

        for column_name, value in values.items():

            if column_name in self.write_mapping:
                json_values = _deep_merge(json_values, json.loads("{" + self.write_mapping[column_name].replace("{value}", value) + "}"))
            else:
                pg_type = self.column_types.get(column_name, "text")

                # Handle JSONB/JSON types
                if pg_type.lower() in ("json", "jsonb"):
                    if isinstance(value, str):
                        # Value is already a JSON string, parse it to a Python object
                        try:
                            json_values[column_name] = json.loads(value)
                        except json.JSONDecodeError:
                            log_to_postgres(f"Invalid JSON in column {column_name}", ERROR)
                            json_values[column_name] = value
                    else: # Value is already a Python object
                        json_values[column_name] = value
                else: # Standard values
                    json_values[column_name] = value

        return json_values


    def update(self, rowid, newvalues):
        _fdw_debug(f"update() called, rowid={rowid}, update_method={self.update_method}, byid_path={self.byid_path}, keys={list(newvalues.keys()) if newvalues else 'None'}")
        log_to_postgres(f"[FDW DEBUG] update() called, rowid={rowid}, update_method={self.update_method}, byid_path={self.byid_path}, keys={list(newvalues.keys()) if newvalues else 'None'}", WARNING)
        if not self.update_method:
            log_to_postgres("No update method defined", ERROR)
            return

        path = self.byid_path.replace(f"{{{self.id_column}}}", str(rowid))
        url = f"{self.base_url}{path}"

        json_values = self._prepare_values_for_json(newvalues)
        _fdw_debug(f"update() url={url}, method={self.update_method}, json_keys={list(json_values.keys())}, json_types={{k: type(v).__name__ for k, v in json_values.items()}}")
        log_to_postgres(f"[FDW DEBUG] update() url={url}, method={self.update_method}, json_keys={list(json_values.keys())}, json_types={{k: type(v).__name__ for k, v in json_values.items()}}", WARNING)

        if self.get_before_update:
            existing_values = self._make_request(url, None)
            json_values = _deep_merge(existing_values, json_values)

        response = None
        try:
            response = requests.request(
                method=self.update_method,
                url=url,
                json=json_values,
                headers=self._get_headers(),
                timeout=30,
            )
            _fdw_debug(f"update() response status={response.status_code}, body={response.text[:2000] if response.text else 'empty'}")
            log_to_postgres(f"[FDW DEBUG] update() response status={response.status_code}, body_preview={response.text[:500] if response.text else 'empty'}", WARNING)
            response.raise_for_status()

            if self.status_field and self.status_value and response.json()[self.status_field] != self.status_value:
                log_to_postgres(f"Incorrect status: {response.text}", ERROR)
                return None

            # Return updated values
            results = self._extract_data(self.byid_result_path, response.json())
            rows = self._extract_rows(results, self.mapping, self.columns)
            return rows[0]

        except requests.RequestException as e:
            resp_body = 'N/A'
            if response is not None:
                resp_body = response.text[:2000] if response.text else 'empty'
            _fdw_debug(f"update() FAILED: {str(e)} -- sf_response: {resp_body}")
            log_to_postgres(f"REST API update failed: {str(e)} -- sf_response: {resp_body}", ERROR)


    def delete(self, rowid):
        if not self.delete_method:
            log_to_postgres("No delete method defined", ERROR)
            return

        # Start with the base path
        path = self.byid_path.replace(f"{{{self.rowid_column}}}", str(rowid))
        url = f"{self.base_url}{path}"

        try:
            response = requests.request(
                method=self.delete_method,
                url=url,
                headers=self._get_headers(),
                timeout=30,
            )
            response.raise_for_status()

            if self.status_field and self.status_value and response.json()[self.status_field] != self.status_value:
                log_to_postgres(f"Incorrect status: {response.text}", ERROR)
                return None

        except requests.RequestException as e:
            log_to_postgres(f"REST API delete failed: {str(e)}", ERROR)


    # Estimate the size of the result.
    def get_rel_size(self, quals, columns):
        num_columns = max(1, len(columns) if columns is not None else 1)
        return (self.row_count, num_columns * 20)


    # Inform the planner about the available path parameters
    # Because of a bug in multicorn, this results in the wrong costs, so we don't use it
    # def get_path_keys(self):
    #     result = []
    #     for param in self.path_parameters:
    #         if param in self.columns:
    #             result.append(((param,), 1))
    #     return result


# Merge two dictionaries recursively.
def _deep_merge(dict1, dict2):
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result:
            if isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = _deep_merge(result[key], value)
            elif isinstance(result[key], list) and isinstance(value, list):
                # Merge list items by index
                for i, item in enumerate(value):
                    if i < len(result[key]):
                        result[key][i] = _deep_merge(result[key][i], item)
                    else:
                        result[key].append(item)
            else:
                result[key] = value
        else:
            result[key] = value
    return result


