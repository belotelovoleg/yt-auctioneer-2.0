import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],
  output: 'standalone',
  generateBuildId: () => {
    console.log('🔧 Build-time environment check:');
    console.log('DATABASE_URL:', !!process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('JWT_SECRET:', !!process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    console.log('YOUTUBE_API_KEY:', !!process.env.YOUTUBE_API_KEY ? 'SET' : 'NOT SET');
    return 'amplify-build-' + Date.now();
  },
};

export default nextConfig;
