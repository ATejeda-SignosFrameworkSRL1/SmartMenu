/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://172.31.98.64:5041/api/:path*' },
      { source: '/uploads/:path*', destination: 'http://172.31.98.64:5041/uploads/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://172.31.98.64:5042',
  },
  // Optimización para evitar chunk errors con html5-qrcode en HTTPS
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            html5qrcode: {
              test: /[\\/]node_modules[\\/]html5-qrcode[\\/]/,
              name: 'html5-qrcode',
              chunks: 'async',
              priority: 10,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
