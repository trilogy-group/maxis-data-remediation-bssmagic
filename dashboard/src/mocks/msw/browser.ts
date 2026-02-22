'use client';
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export async function startMsw(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'true') return;

  const wndow = window as unknown as { __MSW_STARTED__?: boolean };
  if (wndow.__MSW_STARTED__) return;

  const workerUrl =
    process.env.NEXT_PUBLIC_BUILD_FOR_PREVIEW === 'true'
      ? `${process.env.NEXT_PUBLIC_PREVIEW_BASE_PATH}/mockServiceWorker.js`
      : 'mockServiceWorker.js';

  // avoids:
  // [MSW] Cannot intercept requests on this page because it's outside of the worker's scope
  // https://github.com/mswjs/msw/issues/690#issuecomment-849552403
  const scope = '/';

  const worker = setupWorker(...handlers);
  await worker.start({ serviceWorker: { url: workerUrl, options: { scope } } });

  wndow.__MSW_STARTED__ = true;
}
