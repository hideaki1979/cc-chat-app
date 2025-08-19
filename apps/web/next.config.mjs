/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel向けの最適化
  transpilePackages: ['@repo/ui'],
  // TailwindCSS v4のVercel本番環境対応
  experimental: {
    // CSS最適化を無効化してTailwindCSS v4の互換性を確保
    optimizePackageImports: [],
  },
};

export default nextConfig;
