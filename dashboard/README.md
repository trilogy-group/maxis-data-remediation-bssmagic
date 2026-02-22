# TMF template

Template for a NextJS application that uses the TMF API.

## Development

```bash
npm install
npm run dev
```

### Preview Mode

To run the application in preview mode, set the `NEXT_PUBLIC_BUILD_FOR_PREVIEW`
environment variable to `true`. This will append the
`NEXT_PUBLIC_PREVIEW_BASE_PATH` to the requests to the TMF API and the MWS
service worker.

### Mock Mode

To run the application in mock mode, set the `NEXT_PUBLIC_USE_MOCK_DATA`
environment variable to `true`. This will make all `/api/tmf-api/*` requests
to be handled by the MWS service worker in the browser.
