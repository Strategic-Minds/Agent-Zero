/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tell Next.js these routes are server-only — don't pre-render/collect at build time
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', 'groq-sdk']
  },
  // Prevent build from failing when env vars are missing at compile time
  // They will be present at Vercel runtime
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
