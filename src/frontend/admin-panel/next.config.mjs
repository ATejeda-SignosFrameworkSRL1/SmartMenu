/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'smartmenu.com.do', '172.31.98.64'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://172.31.98.64:5042',
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://172.31.98.64:5041/api/:path*' },
      { source: '/uploads/:path*', destination: 'http://172.31.98.64:5041/uploads/:path*' },
    ];
  },
};

export default nextConfig;
