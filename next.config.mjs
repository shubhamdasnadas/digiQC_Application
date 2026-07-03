/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'images.pexels.com' }],
  },
  serverExternalPackages: ['xlsx-js-style'],
};

export default nextConfig;
