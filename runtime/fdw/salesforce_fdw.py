import json
import requests

import pprint
import urllib.error
import urllib.parse
import urllib.request
from queue import Queue
from threading import Thread
from datetime import datetime
from multicorn import ColumnDefinition, ForeignDataWrapper, TableDefinition
from multicorn.utils import DEBUG, ERROR, INFO, WARNING, log_to_postgres

from .salesforce_fdw_services import (
    CaseInsensitiveDict,
    _get_oauth_token,
    _get_sobject_describe,
    _get_sobjects,
    _map_sf_type_to_pg,
    parseToQueue,
    _get_sobject_record_counts,
)


class SalesforceForeignDataWrapper(ForeignDataWrapper):
    _startup_cost = 200  # ~milliseconds per salesforce API call

    def __init__(self, options, columns):
        log_to_postgres(
            f"-> FDW __init__ called (columns={len(columns)})",
            DEBUG,
        )
        super(SalesforceForeignDataWrapper, self).__init__(options, columns)

        self.columns = columns
        self.column_map = CaseInsensitiveDict(dict([(x, x) for x in columns]))

        self.obj_type = options.get("obj_type", None)
        if self.obj_type is None:
            log_to_postgres(
                "Missing required 'obj_type' option for Salesforce foreign table. "
                "The 'obj_type' must specify the Salesforce object name (e.g., 'Account', 'Contact', 'Opportunity'). "
                "Set this option when creating the foreign table: "
                "CREATE FOREIGN TABLE my_table (...) SERVER my_server OPTIONS (obj_type 'Account');",
                ERROR,
            )

        self.allow_writes = options.get("allow_writes", "false").lower() == "true"

        # Collect authentication parameters and check for missing ones
        self.client_id = options.get("client_id", None)
        self.client_secret = options.get("client_secret", None)
        self.username = options.get("username", None)
        self.password = options.get("password", None)
        self.login_server = options.get("login_server", None)
        self.grant_type = options.get("grant_type", "password")  # Default to password for backward compat

        # Validate required auth params based on grant_type
        missing_auth_params = []
        if self.client_id is None:
            missing_auth_params.append("client_id")
        if self.client_secret is None:
            missing_auth_params.append("client_secret")
        if self.login_server is None:
            missing_auth_params.append("login_server")
        
        # username and password only required for password grant
        if self.grant_type != "client_credentials":
            if self.username is None:
                missing_auth_params.append("username")
            if self.password is None:
                missing_auth_params.append("password")

        if missing_auth_params:
            missing_list = "', '".join(missing_auth_params)
            log_to_postgres(
                f"Missing required Salesforce authentication parameters: '{missing_list}'. "
                f"Grant type: '{self.grant_type}'. "
                "Configure your foreign server with these options. "
                "For client_credentials flow: client_id, client_secret, login_server. "
                "For password flow: client_id, client_secret, username, password, login_server.",
                ERROR,
            )

        self.api_version = options.get("api_version", "v63.0")

        self.sortableFields = set()  
        self.nillableFields = set()
        self.updateableFields = set()
        self.createDefaultFields = set()
        self.createableFields = set()
        for column_name, column in self.columns.items():
            if column.options.get("sortable", "false").lower() == "true":
                self.sortableFields.add(column_name)
            if column.options.get("nillable", "true").lower() == "true":
                self.nillableFields.add(column_name)
            if column.options.get("updateable", "true").lower() == "true":
                self.updateableFields.add(column_name)
            if column.options.get("defaultedoncreate", "false").lower() == "true":
                self.createDefaultFields.add(column_name)
            if column.options.get("createable", "true").lower() == "true":
                self.createableFields.add(column_name)

        srv_options_for_token = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "username": self.username,
            "password": self.password,
            "login_server": self.login_server,
            "api_version": self.api_version,
            "grant_type": self.grant_type,
        }

        log_to_postgres(f"FDW using OAuth grant_type: {self.grant_type}", INFO)
        self.oauth = _get_oauth_token(srv_options_for_token)

        if not self.oauth:
            log_to_postgres("Failed to obtain OAuth token during FDW initialization.", ERROR)

        row_count = options.get("row_count")
        if row_count:
            self.row_count = int(row_count)
        else:
            self.row_count = 10 

        # TODO: Use this to implement analyze foreign table
        # TODO: (and/or somehow have a way to trigger it when doing something other than just on first query)
        # TODO: For now, user can do: ALTER FOREIGN TABLE "UserRole" OPTIONS (row_count '1');
        # # Try to get the record count for the missing objects - should only be a few edge cases like UserRole
        #     params = urllib.parse.urlencode({"q": f"SELECT COUNT(Id) FROM {self.obj_type}"})
        #     resp = self._make_request( "GET", f"/query?{params}", warnOnly=True)
        #     if (
        #         resp
        #         and "records" in resp
        #         and isinstance(resp["records"], list)
        #         and len(resp["records"]) > 0
        #         and "expr0" in resp["records"][0]
        #     ):
        #         self.row_count = resp["records"][0]["expr0"]
        #         # TODO: update the row_count in the options
        #     log_to_postgres(f"Row count for {self.obj_type}: {self.row_count}", WARNING)

    # TODO: Return all indexed fields
    # TODO: For the time being, we could just return Id because we know every salesforce object has it and it's unique
    # TODO: However, because multicorn does not set req_outer in its parameterized paths, postgres does not multiply out
    #       the startup cost of each query, so including this results in very inefficent joins
    # def get_path_keys(self):
    #     return [(('Id',), 1)]

    def can_limit(self, limit, offset):
        if self.obj_type == "_bssmagic_table_list":
            return False
        
        if offset is not None and offset > 2000: # Salesforce has a maximum offset of 2000
            return False

        return True

    # Return the sortkeys only up to the first unsortable field
    def can_sort(self, sortkeys):
        if self.obj_type == "_bssmagic_table_list":
            return []
        
        sortable = []
        for sk in sortkeys:
            if getattr(sk, "attname", None) in self.sortableFields:
                sortable.append(sk)
            else:
                break  # Stop at first unsortable field
        return sortable

    #Uses cached record counts to estimate rel size, without applying any filters
    def get_rel_size(self, quals, columns):
        num_columns = max(1, len(columns) if columns is not None else 1)
        return (self.row_count, num_columns * 20)

    def explain(self, quals, columns, sortkeys=None, verbose=False, limit=None, offset=None):
        query = self._build_soql_query(quals, columns, sortkeys, limit, offset)
        return ["salesforce_fdw: %s" % query]

    def execute(self, quals, columns, sortkeys=None, retry=True, limit=None, offset=None):
        
        # If the object type is _bssmagic_table_list, return a list of all the Salesforce objects
        if self.obj_type == "_bssmagic_table_list":
            for obj in _get_sobjects( self.oauth ):
                if obj.get("queryable"):
                    yield {
                        "name": obj.get("name"),
                        "description": obj.get("label"),
                    }
            return
            
        query = self._build_soql_query(quals, columns, sortkeys, limit, offset)
        
        log_to_postgres("FDW generated SOQL query: %s" % query, INFO)

        params = urllib.parse.urlencode({"q": query})

        query_url = self.oauth["instance_url"] + "/services/data/" + self.api_version + "/query?%s" % params

        log_to_postgres(f"FDW requesting URL: {query_url}", DEBUG)

        headers = {"Authorization": "OAuth %s" % self.oauth["access_token"]}

        req = urllib.request.Request(query_url, None, headers)

        queue = Queue()

        try:
            log_to_postgres("FDW opening URL request...", DEBUG)
            stream = urllib.request.urlopen(req)
            log_to_postgres("FDW URL request opened successfully.", DEBUG)
        except urllib.error.URLError as e:
            log_to_postgres(
                f"FDW URL Error Code: {e.code if hasattr(e, 'code') else 'N/A'}, Reason: {e.reason if hasattr(e, 'reason') else 'N/A'}",
                ERROR,
            )

            if hasattr(e, "code"):
                if e.code == 401 and retry:
                    log_to_postgres("Invalid token - trying refresh")

                    srv_options_for_refresh = {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "username": self.username,
                        "password": self.password,
                        "login_server": self.login_server,
                        "api_version": self.api_version,
                        "grant_type": self.grant_type,
                    }

                    self.oauth = _get_oauth_token(srv_options_for_refresh)

                    if not self.oauth:
                        log_to_postgres("Failed to refresh OAuth token during execute.", ERROR)

                        return

                    for line in self.execute(quals, columns, False):
                        yield line

                    return
                else:
                    log_to_postgres("HTTP status %d" % e.code, ERROR)
            elif hasattr(e, "reason"):
                log_to_postgres(
                    "Error posting to URL %s: %d %s" % (query_url, e.reason[0], e.reason[1]),
                    ERROR,
                )
            else:
                log_to_postgres("Unknown error %s" % e, ERROR)

            log_to_postgres(f"FDW URL request failed: {e}", ERROR)

            return

        log_to_postgres("FDW starting parse thread...", DEBUG)

        thread_parse_to_queue = Thread(target=parseToQueue, args=(stream, queue, self.column_map))
        thread_parse_to_queue.daemon = True
        thread_parse_to_queue.start()

        log_to_postgres("FDW waiting for item from queue...", DEBUG)

        item = queue.get()

        while item is not None:
            log_to_postgres(f"FDW retrieved item from queue: {item}", DEBUG)
            yield item
            queue.task_done()
            item = queue.get()

        log_to_postgres("FDW finished retrieving items (got None).", DEBUG)
        thread_parse_to_queue.join(timeout=1.0)
        log_to_postgres("FDW execute method finished.", DEBUG)

    def _build_soql_query(self, quals, columns, sortkeys, limit, offset):
        """
        Build a SOQL query from the provided qualifiers and columns.

        Args:
            quals: List of qualifiers (WHERE conditions)
            columns: List of column names to SELECT
            sortkeys: List of sort keys

        Returns:
            str: Complete SOQL query string
        """

        # Sort columns to ensure consistent order
        if columns is None or len(columns) == 0:
            cols = "Id"
        else:   
            # Id is row ID, so it should always be included if the table is writable         
            if self.allow_writes and "Id" not in columns:
                columns = ["Id"] + list(columns)
            cols = ", ".join(sorted(columns))

        where = ""

        for qual in quals:
            if qual.operator in ("~~", "!~~"):
                operator = "LIKE"
            elif qual.operator in ("<", "=", ">", ">=", "<=", "<>"):
                operator = qual.operator
            elif isinstance(qual.operator, tuple):
                operator = qual.operator[0]
                isAny = qual.operator[1]
                if isAny and operator == "=":
                    operator = "IN"
                elif not isAny and operator == "<>":
                    operator = "NOT IN"
                else:
                    log_to_postgres(f"Unsupported {'ANY' if isAny else 'ALL'} operator: {qual.operator}", WARNING)
                    log_to_postgres(f"for values: {qual.value}", WARNING)
                    continue
            elif qual.operator == "IS":
                operator = "="
            elif qual.operator == "IS NOT":
                operator = "<>"
            else:
                log_to_postgres(f"Unsupported operator: {qual.operator}", WARNING)
                continue

            value = qual.value
            if self.columns[qual.field_name].base_type_name == "boolean":
                value = "TRUE" if value == "t" else "FALSE"
            elif ( isinstance(value, str) ):
                if self.columns[qual.field_name].base_type_name == "text":
                    value = "'" + value.replace("'", "''") + "'"
            elif isinstance(value, datetime):
                value = value.isoformat(sep="T", timespec="milliseconds") + "Z"
            elif isinstance(value, list):
                value = str(tuple(value))

            if value is None:
                where += " AND %s %s NULL" % (qual.field_name, operator)
            elif qual.operator == "!~~":
                where += " AND NOT (%s %s %s)" % (qual.field_name, operator, value)
            else:
                where += " AND %s %s %s" % (qual.field_name, operator, value)

        where = where[5:] if where.startswith(" AND ") else where

        query = "SELECT " + cols + " FROM " + self.obj_type

        if len(where) > 0:
            query += " WHERE %s" % where

        if sortkeys is not None:
            order_by = []
            for sortkey in sortkeys:
                order_by.append(f"{sortkey.attname}{sortkey.is_reversed and ' DESC' or ''}{not sortkey.nulls_first and ' NULLS LAST' or ''}")
            query += " ORDER BY %s" % ", ".join(order_by)

        if limit is not None:
            query += " LIMIT %s" % limit

        if offset is not None:
            query += " OFFSET %s" % offset

        return query

    @property
    def rowid_column(self):
        if self.allow_writes:
            return "Id"
        else:
            log_to_postgres( "FDW does not allow writes to this object.", ERROR )

    def _make_request( self, method, url, body=None, retry=True, warnOnly=False ):
        try:
            headers = {"Authorization": "OAuth %s" % self.oauth["access_token"]}
            full_url = f'{self.oauth["instance_url"]}/services/data/{self.api_version}{url}'
            log_to_postgres(f"FDW {method} to URL: {full_url}", DEBUG)
            response = requests.request(
                method=method,
                url=full_url,
                json=body,
                headers=headers,
                timeout=30,
            )

            if response.status_code == 401 and retry:
                log_to_postgres("Invalid token - trying refresh", WARNING)
                srv_options_for_refresh = {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "username": self.username,
                    "password": self.password,
                    "login_server": self.login_server,
                    "api_version": self.api_version,
                    "grant_type": self.grant_type,
                }
                self.oauth = _get_oauth_token(srv_options_for_refresh)

                if not self.oauth:
                    log_to_postgres("Failed to refresh OAuth token during execute.", ERROR)

                return self._make_request(method, url, body, False)

            response.raise_for_status()
            if not response.text:
                return None
            return response.json()
        except requests.RequestException as e:
            log_to_postgres(f"Salesforce API request failed: {str(e)}, {response.text}", ERROR if not warnOnly else WARNING)

    def insert(self, values):
        if not self.allow_writes:
            log_to_postgres( "FDW does not allow writes to this object.", ERROR )

        # Remove null values
        values = {field: val for field, val in values.items() if val is not None}

        # Check that all fields in values are actually createable for this object
        non_createable_fields = [field for field in values if field not in self.createableFields]
        if non_createable_fields:
            log_to_postgres(f"Cannot create non-createable fields: {non_createable_fields}", ERROR)

        # Check if any required fields are missing
        missing_required = [
            field for field in self.createableFields
            if (
                field not in self.nillableFields and
                field not in self.createDefaultFields and
                (field not in values or values[field] is None)
            )
        ]
        if missing_required:
            log_to_postgres( f"Missing required fields for Salesforce: {missing_required}", ERROR )

        # Serialize Dates/Times as ISO 8601 strings
        for field, value in values.items():
            if isinstance(value, datetime):
                column = self.columns.get(field)
                if column and column.type_name.lower() == "date":
                    values[field] = value.date().isoformat()
                else:
                    values[field] = value.isoformat(sep="T", timespec="milliseconds") + "Z"

        composite_request = {
            "allOrNone": False,
            "compositeRequest": [
                {
                    "method": "POST",
                    "url": f"/services/data/{self.api_version}/sobjects/{self.obj_type}",
                    "referenceId": "newAccount",
                    "body": values
                },
                {
                    "method": "GET",
                    "url": f"/services/data/{self.api_version}/sobjects/{self.obj_type}" + "/@{newAccount.id}",
                    "referenceId": "getAccount"
                }
            ]
        }  

        response = self._make_request("POST", f"/composite", composite_request)
        if response['compositeResponse'][0]['httpStatusCode'] != 201:
            if isinstance(response['compositeResponse'][0]['body'], dict) and 'errors' in response['compositeResponse'][0]['body']:
                log_to_postgres(f"Salesforce API request failed with {response['compositeResponse'][0]['httpStatusCode']}: {response['compositeResponse'][0]['body']['errors']}", ERROR)
            else:
                log_to_postgres(f"Salesforce API request failed with {response['compositeResponse'][0]['httpStatusCode']}: {response['compositeResponse'][0]['body']}", ERROR)
        
        return response['compositeResponse'][1]['body']


    def update(self, rowid, newvalues):
        if not self.allow_writes:
            log_to_postgres( "FDW does not allow writes to this object.", ERROR )
        
        # Check for any fields in newvalues that are not updateable
        not_updateable = [field for field in newvalues if field not in self.updateableFields]
        if not_updateable:
            # Remove any non-updateable fields from newvalues for now. In theory, we should only get the new values...
            for field in not_updateable:
                newvalues.pop(field, None)
            # log_to_postgres(f"Attempt to update non-updateable Salesforce fields: {not_updateable}, {newvalues}, {rowid}", ERROR)
        
        # Check if any required fields are set to null
        null_required = [field for field, value in newvalues.items() if value is None and field not in self.nillableFields]
        if null_required:
            log_to_postgres( f"Non-nullable fields set to null for Salesforce update: {null_required}", ERROR )

        # Serialize Dates/Times as ISO 8601 strings
        for field, value in newvalues.items():
            if isinstance(value, datetime):
                column = self.columns.get(field)
                if column and column.type_name.lower() == "date":
                    newvalues[field] = value.date().isoformat()
                else:
                    newvalues[field] = value.isoformat(sep="T", timespec="milliseconds") + "Z"

        composite_request = {
            "allOrNone": False,
            "compositeRequest": [
                {
                    "method": "PATCH",
                    "url": f"/services/data/{self.api_version}/sobjects/{self.obj_type}/{rowid}",
                    "referenceId": "updateAccount",
                    "body": newvalues
                },
                {
                    "method": "GET",
                    "url": f"/services/data/{self.api_version}/sobjects/{self.obj_type}/{rowid}",
                    "referenceId": "getAccount"
                }
            ]
        }  

        response = self._make_request("POST", f"/composite", composite_request)
        if response['compositeResponse'][0]['httpStatusCode'] != 204:
            if isinstance(response['compositeResponse'][0]['body'], dict) and 'errors' in response['compositeResponse'][0]['body']:
                log_to_postgres(f"Salesforce API request failed with {response['compositeResponse'][0]['httpStatusCode']}: {response['compositeResponse'][0]['body']['errors']}", ERROR)
            else:
                log_to_postgres(f"Salesforce API request failed with {response['compositeResponse'][0]['httpStatusCode']}: {response['compositeResponse'][0]['body']}", ERROR)
        
        return response['compositeResponse'][1]['body']


    def delete(self, rowid):
        if not self.allow_writes:
            log_to_postgres( "FDW does not allow writes to this object.", ERROR )

        response = self._make_request("DELETE", f"/sobjects/{self.obj_type}/{rowid}")


    @classmethod
    def import_schema(cls, schema, srv_options, options, restriction_type, restricts):
        """
        Imports the foreign schema from Salesforce.
        Called on IMPORT FOREIGN SCHEMA command.
        """
        log_to_postgres(f"IMPORT: Original SQL restriction_type='{restriction_type}', restricts='{restricts}'", DEBUG)
        log_to_postgres(f"IMPORT: Received FDW options (count={len(options)})", DEBUG)
        log_to_postgres(f"IMPORT: Source schema: '{schema}'", WARNING)

        oauth_token = _get_oauth_token(srv_options)
        if not oauth_token:
            log_to_postgres("Cannot import schema, failed to get OAuth token.", ERROR)
        
        all_sf_sobjects_metadata = _get_sobjects(oauth_token)
        if all_sf_sobjects_metadata is None:
            log_to_postgres("Failed to retrieve SObjects list from Salesforce for FDW-option-based import.", ERROR)

        restricts = [name.lower() for name in (restricts or [])]

        target_sobjects = []

        for sf_object_meta in all_sf_sobjects_metadata:
            if not sf_object_meta.get("queryable"):
                continue
            elif restriction_type == "limit" and sf_object_meta.get("name", "").lower() in restricts:
                target_sobjects.append(sf_object_meta)
            elif restriction_type == "except" and sf_object_meta.get("name", "").lower() not in restricts:
                target_sobjects.append(sf_object_meta)
            elif not restriction_type:
                target_sobjects.append(sf_object_meta)

        target_table_names = [sobject["name"] for sobject in target_sobjects]

        if "_bssmagic_table_list" in restricts:
            target_sobjects.append( {"name": "_bssmagic_table_list"} )

        table_defs = []

        record_counts = _get_sobject_record_counts(oauth_token, target_table_names)
        describe_infos = _get_sobject_describe(oauth_token, target_table_names)

        for sobject in target_sobjects:  # Loop over the SObjects selected by the FDW option
            sobject_name = sobject["name"]

            if sobject_name == "_bssmagic_table_list":
                columns = [ ColumnDefinition( column_name='name', type_name='text' ), ColumnDefinition( column_name='description', type_name='text' ) ]
                table_def = TableDefinition(
                    table_name=sobject_name,
                    columns=columns,
                    options={"obj_type": sobject_name}
                )
                table_defs.append(table_def)
                log_to_postgres( f"Prepared table definition for {sobject_name} with {len(columns)} columns.", DEBUG )
                continue
            
            describe_info = describe_infos.get(sobject_name)

            if not describe_info or "fields" not in describe_info:
                log_to_postgres( f"Failed to describe SObject {sobject_name} or no fields found, skipping.", WARNING )
                continue

            column_defs = []
            sortable_fields = []
            for field in describe_info.get("fields", []):
                field_name = field.get("name")
                sf_type = field.get("type")

                if not field_name or not sf_type:
                    continue

                pg_type = _map_sf_type_to_pg(
                    sf_type,
                    field.get("length"),
                    field.get("precision"),
                    field.get("scale"),
                )

                if pg_type:

                    options = {}
                    if not field.get("createable", True):
                        options["createable"] = 'false'

                    if field.get("defaultedOnCreate", False):
                        options["defaultedoncreate"] = 'true'

                    if not field.get("updateable", True):
                        options["updateable"] = 'false'

                    if not field.get("nillable", True):
                        options["nillable"] = 'false'

                    if field.get("sortable", False):
                        options["sortable"] = 'true'
                        
                    col_def = ColumnDefinition(column_name=field_name, type_name=pg_type, options=options)
                    column_defs.append(col_def)
                else:
                    log_to_postgres(
                        f"Skipping field {sobject_name}.{field_name} (type: {sf_type}) because it cannot be mapped to a PostgreSQL type.",
                        DEBUG,
                    )
                    pass  # Continue to next field if mapping returns None

            if column_defs:
                table_name = sobject_name
                record_count = record_counts.get(table_name)
                current_table_options = {"obj_type": table_name}
                if record_count is not None:
                    current_table_options["row_count"] = str(record_count)

                table_def = TableDefinition(
                    table_name=table_name,
                    columns=column_defs,
                    options=current_table_options,
                )
                table_defs.append(table_def)
                log_to_postgres(
                    f"Prepared table definition for {table_name} with {len(column_defs)} columns.",
                    DEBUG,
                )
            else:
                log_to_postgres(
                    f"No suitable columns found for SObject {sobject_name}, skipping table definition.",
                    WARNING,
                )

        if table_defs:
            log_to_postgres(
                f"IMPORT: Preparing to return {len(table_defs)} table definitions.",
                INFO,
            )
            for i, td in enumerate(table_defs):
                column_details_str = pprint.pformat([(col.column_name, col.type_name) for col in td.columns], indent=4)
                options_str = pprint.pformat(td.options, indent=4)
                log_to_postgres(
                    f"  TableDef[{i}]: Name='{td.table_name}'\n"
                    f"  Columns ({len(td.columns)}):\n{column_details_str}\n"
                    f"  Options:\n{options_str}",
                    DEBUG,
                )

        return table_defs
