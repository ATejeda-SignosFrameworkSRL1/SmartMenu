import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: ["@smartmenu/ui"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
  async rewrites() {
    const backendHttp = process.env.BACKEND_HTTP_URL || 'http://localhost:5041';
    return [
      { source: '/api/:path*', destination: `${backendHttp}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backendHttp}/uploads/:path*` },
      { source: '/hubs/:path*', destination: `${backendHttp}/hubs/:path*` },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
  },

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};

export default withNextIntl(nextConfig);
