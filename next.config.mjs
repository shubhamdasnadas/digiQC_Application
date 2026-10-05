/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'images.pexels.com' }],
  },
  serverExternalPackages: ['xlsx-js-style'],
  turbopack: {},
  // Allow hot-reloading & WebSockets across local network LAN IPs
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.9.64:3000',
    '192.168.9.64',
    '192.168.*.*',
    '192.168.*.*:3000',
    '*.local',
  ],
};

export default nextConfig;
