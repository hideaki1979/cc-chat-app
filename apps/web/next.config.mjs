/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['tailwindcss'],
  },
  // Vercel向けの最適化
  transpilePackages: ['@repo/ui'],
};

export default nextConfig;
