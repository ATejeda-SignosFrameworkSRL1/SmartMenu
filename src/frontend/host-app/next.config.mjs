/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'out',
  reactStrictMode: true,
  allowedDevOrigins: ['10.0.0.24'],
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
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://10.0.0.24:5042',
  },
};

export default nextConfig;
