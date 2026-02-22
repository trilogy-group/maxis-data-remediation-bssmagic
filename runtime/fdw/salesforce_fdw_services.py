import collections.abc
import json
import os
import requests
import xmltodict
import urllib.error
import urllib.parse
import urllib.request

from multicorn.utils import DEBUG, ERROR, INFO, WARNING, log_to_postgres
from yajl import YajlContentHandler, YajlParser

# Global cache for SObjects, keyed by instance_url
_sobjects_cache = {}

# Global cache for SObject describe info, keyed by (instance_url, sobject_name)
_sobject_describe_cache = {}

#record counts cache
_record_counts_cache = None

def _get_oauth_token(srv_options):
    """Helper to get OAuth token using server options.
    
    Supports two OAuth flows:
    - client_credentials: Uses only client_id and client_secret (Connected App flow)
    - password (default): Uses client_id, client_secret, username, and password
    
    Set grant_type in srv_options to choose the flow.
    """
    client_id = srv_options.get("client_id")
    client_secret = srv_options.get("client_secret")
    username = srv_options.get("username")
    password = srv_options.get("password")
    login_server = srv_options.get("login_server", "https://login.salesforce.com")
    api_version = srv_options.get("api_version", "v63.0")
    grant_type = srv_options.get("grant_type", "password")  # Default to password for backward compatibility

    # Validate required options based on grant type
    if grant_type == "client_credentials":
        # Client credentials flow only needs client_id and client_secret
        required_options = {
            "client_id": client_id,
            "client_secret": client_secret,
        }
        missing = [key for key, value in required_options.items() if value is None]
        if missing:
            log_to_postgres(
                f"Missing required server options for client_credentials flow: {', '.join(missing)}",
                ERROR,
            )
            return None
        
        # Build params for client_credentials flow
        params = urllib.parse.urlencode(
            {
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            }
        ).encode("utf-8")
        
        log_to_postgres(f"Using OAuth client_credentials flow for {login_server}", INFO)
    else:
        # Password flow (original behavior)
        required_options = {
            "client_id": client_id,
            "client_secret": client_secret,
            "username": username,
            "password": password,
        }
        missing = [key for key, value in required_options.items() if value is None]
        if missing:
            log_to_postgres(
                f"Missing required server options for password flow: {', '.join(missing)}",
                ERROR,
            )
            return None
        
        # Build params for password flow
        params = urllib.parse.urlencode(
            {
                "grant_type": "password",
                "client_id": client_id,
                "client_secret": client_secret,
                "username": username,
                "password": password,
            }
        ).encode("utf-8")
        
        log_to_postgres(f"Using OAuth password flow for {login_server}", DEBUG)

    token_url = f"{login_server}/services/oauth2/token"

    log_to_postgres(f"Getting token for schema import from {token_url}", DEBUG)
    try:
        request = urllib.request.Request(token_url, data=params)
        response = urllib.request.urlopen(request)
        data = response.read().decode("utf-8")
        oauth = json.loads(data)
        log_to_postgres(f"Successfully obtained token for schema import from {login_server}", DEBUG)
        # Store api_version and login_server from options in the oauth dict for later use by helpers
        oauth["api_version"] = api_version
        oauth["login_server"] = login_server
        return oauth
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            pass  # Ignore if reading body fails
        log_to_postgres(
            f"HTTP Error {e.code} getting token from {token_url}: {e.reason}. Details: {error_body}",
            ERROR,
        )
        return None
    except urllib.error.URLError as e:
        log_to_postgres(f"URL Error getting token from {token_url}: {e.reason}", ERROR)
        return None
    except json.JSONDecodeError as e:
        log_to_postgres(f"Failed to parse token response from {token_url}: {e}", ERROR)
        return None


def _make_sf_api_request(oauth_token, path):
    """Helper to make authenticated GET requests to Salesforce API."""
    if (
        not oauth_token
        or "instance_url" not in oauth_token
        or "access_token" not in oauth_token
        or "api_version" not in oauth_token
    ):
        log_to_postgres("Invalid or incomplete OAuth token provided for API request.", ERROR)
        return None

    api_version = oauth_token["api_version"]
    url = f"{oauth_token['instance_url']}/services/data/{api_version}{path}"
    # Use Bearer token type for API calls, not OAuth for the Authorization header value
    headers = {"Authorization": f"Bearer {oauth_token['access_token']}"}

    log_to_postgres(f"Making API request to: {url}", DEBUG)
    req = urllib.request.Request(url, headers=headers)

    try:
        response = urllib.request.urlopen(req)
        data = response.read().decode("utf-8")
        return json.loads(data)
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            pass
        # Downgrade harmless COUNT() query errors to WARNING so imports don't abort
        downgrade_warning = False
        try:
            if path.startswith("/query?"):
                parsed = urllib.parse.urlparse(path)
                qs = urllib.parse.parse_qs(parsed.query)
                soql = qs.get("q", [None])[0]
                if soql and "COUNT(" in soql.upper():
                    downgrade_warning = True
        except Exception:
            pass

        if e.code == 400 and downgrade_warning:
            # COUNT() not supported for some objects; warn and continue with fallback
            msg = f"HTTP {e.code} on COUNT query. Details: {error_body}. Continuing with default record count."
            log_to_postgres(msg, WARNING)
            return None

        log_to_postgres(
            f"HTTP Error {e.code} making API request to {url}: {e.reason}. Details: {error_body}",
            ERROR,
        )
        return None
    except urllib.error.URLError as e:
        log_to_postgres(f"URL Error making API request to {url}: {e.reason}", ERROR)
        return None
    except json.JSONDecodeError as e:
        log_to_postgres(f"Failed to parse API response from {url}: {e}", ERROR)
        return None


def _get_sobjects(oauth_token):
    """Gets list of all SObjects, utilizing an in-memory cache."""
    instance_url = oauth_token.get("instance_url")

    if instance_url and instance_url in _sobjects_cache:
        log_to_postgres(f"Returning cached SObjects list for instance: {instance_url}", DEBUG)

        return _sobjects_cache[instance_url]

    response_data = _make_sf_api_request(oauth_token, "/sobjects/")

    if response_data and "sobjects" in response_data:
        sobjects_list = response_data["sobjects"]
        log_to_postgres(f"Retrieved {len(sobjects_list)} SObjects descriptions.", DEBUG)

        if instance_url:
            _sobjects_cache[instance_url] = sobjects_list
            log_to_postgres(f"Cached SObjects list for instance: {instance_url}", DEBUG)

        return sobjects_list
    else:
        log_to_postgres("Failed to retrieve SObjects or response format was unexpected.", WARNING)

        return None

# Gets describe metadata for a specific SObject, utilizing an in-memory cache.
def _get_sobject_describe(oauth_token, sobject_names):

    #TODO: Refactor all the request logic used here and throughout the code
    url = f"{oauth_token['instance_url']}/services/Soap/u/{oauth_token['api_version'].lstrip('v')}"

    headers = {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': 'describeSObjects'
    }

    # Break sobject_names into chunks of 100 and retrieve describes for each chunk
    chunk_size = 100
    for i in range(0, len(sobject_names), chunk_size):
        chunk = sobject_names[i:i+chunk_size]
        body =  f"""<?xml version="1.0" encoding="utf-8"?>
                    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
                      <soapenv:Header>
                        <urn:SessionHeader>
                        <urn:sessionId>{oauth_token["access_token"]}</urn:sessionId>
                        </urn:SessionHeader>
                    </soapenv:Header>
                    <soapenv:Body>
                        <urn:describeSObjects>
                        {''.join(f'<urn:sObjectType>{name}</urn:sObjectType>' for name in chunk)}
                        </urn:describeSObjects>
                    </soapenv:Body>
                    </soapenv:Envelope>"""

        response = requests.post(url, headers=headers, data=body)
        data = xmltodict.parse(response.content)
        results = data['soapenv:Envelope']['soapenv:Body']
        if 'describeSObjectsResponse' not in results:
            log_to_postgres(f"Failed to retrieve describe info for SObjects: {results}", ERROR)
            continue

        chunk_results = results['describeSObjectsResponse']['result']
        chunk_results = chunk_results if isinstance(chunk_results, list) else [chunk_results]
        for obj in chunk_results:
            if 'fields' in obj and isinstance(obj['fields'], dict):
                # In some cases with just one field SOAP returns as an object, so wrap in a list
                obj['fields'] = [obj['fields']]
                
            # Convert boolean string values to boolean
            for field in obj.get("fields", []):
                if isinstance(field, dict):
                    for k, v in field.items():
                        if isinstance(v, str):
                            if v == "true":
                                field[k] = True
                            elif v == "false":
                                field[k] = False

            _sobject_describe_cache[obj['name']] = obj

    return _sobject_describe_cache


def _map_sf_type_to_pg(sf_type, length, precision, scale):
    """Maps Salesforce data types to PostgreSQL types."""
    sf_type_lower = sf_type.lower()

    if sf_type_lower in (
        "string",
        "textarea",
        "picklist",
        "multipicklist",
        "id",
        "reference",
        "url",
        "phone",
        "email",
        "encryptedstring",
        "datacategorygroupreference",
        "anytype",
        "combobox",
    ):
        return "text"
    elif sf_type_lower == "boolean":
        return "boolean"
    elif sf_type_lower == "int":
        return "integer"
    elif sf_type_lower == "long":
        return "bigint"
    elif sf_type_lower in ("double", "percent"):
        return "double precision"
    elif sf_type_lower == "currency":
        pg_precision = precision if precision is not None else 18
        pg_scale = scale if scale is not None else 2
        return f"numeric({pg_precision}, {pg_scale})"
    elif sf_type_lower == "date":
        return "date"
    elif sf_type_lower in ("datetime", "time"):
        return "timestamp without time zone"
    elif sf_type_lower == "base64":
        return "bytea"
    elif sf_type_lower in ("address", "location", "complexvalue"):
        # These are compound types. Skipping them as they require special handling.
        log_to_postgres(
            f"Skipping mapping for complex/compound Salesforce type: '{sf_type}' to allow import to proceed.",
            DEBUG,
        )
        return None  # Indicates this field type should be skipped
    else:
        log_to_postgres(
            f"Unknown Salesforce type '{sf_type}'. Mapping to 'text' as a fallback.",
            WARNING,
        )
        return "text"


class CaseInsensitiveDict(collections.abc.Mapping):
    def __init__(self, d):
        self._d = d
        self._s = dict((k.lower(), k) for k in d)

    def __contains__(self, k):
        return k.lower() in self._s

    def __len__(self):
        return len(self._s)

    def __iter__(self):
        return iter(self._s)

    def __getitem__(self, k):
        return self._d[self._s[k.lower()]]

    def actual_key_case(self, k):
        return self._s.get(k.lower())


# ContentHandler implements a simple state machine to parse the records from
# the incoming JSON stream, adding them to the queue as maps of column name
# to column value. We skip over any record properties that are not simple
# values (e.g. attributes, which is an object containing the record's type
# and URL)/
class ContentHandler(YajlContentHandler):
    _column = ""

    INIT = 0
    IN_OBJECT = 1
    SEEN_RECORDS = 2
    IN_ARRAY = 3
    IN_RECORD = 4
    SEEN_KEY = 5

    _state = INIT

    _depth = 0

    def __init__(self, queue, column_map):
        self._queue = queue
        self._column_map = column_map

    def handle_value(self, ctx, val):
        if self._state == ContentHandler.SEEN_KEY and self._depth == 0:
            self._state = ContentHandler.IN_RECORD
            if self._column in self._column_map:
                self._record[self._column_map[self._column]] = val

    def yajl_null(self, ctx):
        self.handle_value(ctx, None)

    def yajl_boolean(self, ctx, boolVal):
        self.handle_value(ctx, boolVal)

    def yajl_integer(self, ctx, integerVal):
        self.handle_value(ctx, integerVal)

    def yajl_double(self, ctx, doubleVal):
        self.handle_value(ctx, doubleVal)

    def yajl_string(self, ctx, stringVal):
        self.handle_value(ctx, stringVal)

    def yajl_start_map(self, ctx):
        if self._state == ContentHandler.SEEN_KEY:
            self._depth += 1
        elif self._state == ContentHandler.IN_ARRAY:
            self._state = ContentHandler.IN_RECORD
            self._record = {}
        elif self._state == ContentHandler.INIT:
            self._state = ContentHandler.IN_OBJECT

    def yajl_map_key(self, ctx, stringVal):
        log_to_postgres(f"ContentHandler saw map key: {stringVal} in state {self._state}", DEBUG)
        if self._state == ContentHandler.IN_RECORD:
            self._state = ContentHandler.SEEN_KEY
            self._column = stringVal.decode("utf-8", errors="ignore")
        elif self._state == ContentHandler.IN_OBJECT and stringVal == b"records":
            self._state = ContentHandler.SEEN_RECORDS

    def yajl_end_map(self, ctx):
        if self._state == ContentHandler.SEEN_KEY:
            self._depth -= 1
            if self._depth == 0:
                self._state = ContentHandler.IN_RECORD
        elif self._state == ContentHandler.IN_RECORD:
            self._state = ContentHandler.IN_ARRAY
            log_to_postgres(f"ContentHandler putting record to queue: {self._record}", DEBUG)
            self._queue.put(self._record)
        elif self._state == ContentHandler.IN_OBJECT:
            self._state = ContentHandler.INIT

    def yajl_start_array(self, ctx):
        if self._state == ContentHandler.SEEN_RECORDS:
            self._state = ContentHandler.IN_ARRAY

    def yajl_end_array(self, ctx):
        if self._state == ContentHandler.IN_ARRAY:
            self._state = ContentHandler.IN_OBJECT


# Parse the given stream to a queue
def parseToQueue(stream, queue, column_map):
    parser = YajlParser(ContentHandler(queue, column_map))
    parser.parse(stream)
    queue.put(None)


# Get record counts for each SObject to use for rel size estimation
def _get_sobject_record_counts(oauth_token, target_names):
    global _record_counts_cache

    if _record_counts_cache is None:
        response_data = _make_sf_api_request(oauth_token, "/limits/recordCount")
        if response_data and "sObjects" in response_data:
            _record_counts_cache = { obj["name"]: obj["count"] for obj in response_data["sObjects"] if "name" in obj and "count" in obj }

    missing_sobjects = set(target_names) - set(_record_counts_cache.keys())
    if len(missing_sobjects) > 0:
        log_to_postgres(f"Missing SOBJECT record counts: {missing_sobjects}", WARNING)

    return _record_counts_cache
