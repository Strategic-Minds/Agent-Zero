/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static generation for API routes and dynamic pages
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Increase static generation timeout
  staticPageGenerationTimeout: 120,
  // Output configuration
  output: "standalone",
}

module.exports = nextConfig
