// CloudFront Function: Add API Key header for TMF API requests
function handler(event) {
    var request = event.request;
    
    // Add X-API-Key header for TMF API requests
    request.headers['x-api-key'] = { value: 'bssmagic-d58d6761265b01accc13e8b21bae8282' };
    
    return request;
}
