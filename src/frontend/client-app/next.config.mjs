import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'smartmenu.com.do', '10.0.0.24'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  async headers() {

    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
  async rewrites() {
    const backendHttp = process.env.BACKEND_HTTP_URL || 'http://localhost:5041';
    return [
      { source: '/api/:path*', destination: `${backendHttp}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backendHttp}/uploads/:path*` },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://10.0.0.24:5042',
  },
};

export default withNextIntl(nextConfig);
