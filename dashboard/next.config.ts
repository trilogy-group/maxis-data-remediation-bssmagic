import type { NextConfig } from 'next';

/**
 * This is a very bad hack...
 *
 * We need a way to proxy a NextJS app through an `<iframe>` displayed by
 * another NextJS app.
 */
const CONFIG_PREVIEW = {
  basePath: process.env.NEXT_PUBLIC_PREVIEW_BASE_PATH || '/preview',
  assetPrefix: process.env.NEXT_PUBLIC_PREVIEW_BASE_PATH || '/preview',
};

const isPreview = process.env.NEXT_PUBLIC_BUILD_FOR_PREVIEW === 'true';
const isMocked = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

const nextConfig: NextConfig = {
  ...(isPreview ? CONFIG_PREVIEW : {}),

  async headers() {
    const items = [];

    // Configuration needed to make the mock data service worker work. From:
    // https://github.com/mswjs/msw/issues/690#issuecomment-849552403
    if (isMocked) {
      items.push({
        source: '/(.*)',
        headers: [{ key: 'Service-Worker-Allowed', value: '/' }],
      });
    }

    return items;
  },

  // Rewrites for AWS deployment: /mw-api/* → /api/* (without basePath prefix)
  async rewrites() {
    return {
      // beforeFiles rewrites are checked before pages/files
      beforeFiles: [
        {
          source: '/mw-api/:path*',
          destination: '/api/:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
