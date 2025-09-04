/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel向けの最適化
  transpilePackages: ['@repo/ui'],
  // TailwindCSS v4のVercel本番環境対応
  experimental: {
    // CSS最適化を無効化してTailwindCSS v4の互換性を確保
    optimizePackageImports: [],
  },
  images: {
    // 画像最適化の許可ドメイン（テンプレ）
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.example.com' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
      // 運用時に実際の配信ドメインへ差し替えてください
    ],
  },
};

export default nextConfig;
