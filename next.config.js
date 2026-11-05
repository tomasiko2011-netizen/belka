/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15+: experimental.serverComponentsExternalPackages -> serverExternalPackages
  serverExternalPackages: ['@libsql/client'],
};

module.exports = nextConfig;
