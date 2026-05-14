/** @type {import('next').NextConfig} */
const nextConfig = {
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
