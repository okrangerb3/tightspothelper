/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    config.cache = false
    return config
  },
  generateBuildId: async () => '1778869141',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [{ key: 'x-content-type-options', value: 'nosniff' }],
      },
    ]
  },
}

module.exports = nextConfig
