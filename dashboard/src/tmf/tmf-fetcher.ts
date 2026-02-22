/**
 * This function is the actual wrapper that MUST be used for every TMF API call
 *
 * It is a very thin wrapper around the `fetch` API. The only differences are:
 * - Prepends the `/api/tmf-api` prefix to the URL
 * - Adds default headers for JSON content
 * - Throws an error if the response is not `2XX`
 */
export async function tmfFetcher<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const headers = options.headers ?? {};

  // when serving a website via an iframe, the website in the `<iframe>` does
  // not know it is in an `<iframe>`. the browser won't interfere with the
  // requests that might be fired from it. whcih means, if we use
  // `<iframe src="example.org">`, the requests made by the iframe will be made
  // to `example.org/*`.
  //
  // the above is fine when the `<iframe>` is another domain. however, in our
  // case, the `<iframe>` is the same domain, which has consequences. as we are
  // doing a _hacky_ proxy through the NextJS backend, all requests will
  // actually go to the NextJS backend, not the backend of the `<iframe>`.
  // EG: if the `<iframe>` is firing `/api/*` requests, it will be handled by
  // the NextJS backend that rendered the `<iframe>`, not the backend of the
  // `<iframe>` itself.
  //
  // below we add a hack that forces the API requests to go through the NextJS
  // backend, but via a prefix that is handled in the middleware. this is
  // definetely not the best solution but it works for the time being
  //
  // TODO: change this to use a proxy server. the best solution would be to
  // serve the website in the `<iframe>` from a different domain
  const fullUrl = `/api/tmf-api${url}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  return { data: await res.json(), status: res.status } as T;
}
