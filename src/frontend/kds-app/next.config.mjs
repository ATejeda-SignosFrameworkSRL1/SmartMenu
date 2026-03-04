/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/kds',
  assetPrefix: '/kds',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://172.31.98.64:5042',
  },
};

export default nextConfig;
