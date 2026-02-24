import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Local development proxy to avoid CORS issues and add custom headers
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      const uploadApiUrl = process.env.NEXT_PUBLIC_UPLOAD_API_URL;
      const verifySecret = process.env.X_ORIGIN_VERIFY_SECRET;

      if (!uploadApiUrl) {
        console.warn('⚠️ NEXT_PUBLIC_UPLOAD_API_URL is not set. Proxying will not work.');
        return [];
      }

      console.log(`🔧 Proxying /api/upload/ to ${uploadApiUrl} with verify header`);

      return [
        {
          source: '/api/upload/:path*',
          destination: `${uploadApiUrl}:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
