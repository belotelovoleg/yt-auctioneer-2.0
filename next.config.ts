import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure environment variables are available in serverless functions
  serverExternalPackages: ['@prisma/client'],
  
  // AWS Amplify requires standalone output mode for proper serverless deployment
  output: 'standalone',
  
  // For AWS Amplify/serverless deployments, we don't use serverRuntimeConfig
  // as it doesn't work with standalone output mode
  // Environment variables are automatically available via process.env
  
  // Define which environment variables should be available in the browser (if any)
  // Note: Only put non-sensitive variables here
  env: {
    // Add any client-side environment variables here if needed
    // NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  
  // Experimental features for AWS Lambda compatibility
  experimental: {
    // Ensure environment variables are properly passed to Lambda functions
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  
  // Force AWS Amplify to pass environment variables to Lambda functions
  // This is critical for AWS Amplify SSR deployment
  generateBuildId: () => {
    // Also log environment status during build for debugging
    console.log('🔧 Build-time environment check:');
    console.log('DATABASE_URL:', !!process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('JWT_SECRET:', !!process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    console.log('NEXTAUTH_SECRET:', !!process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET');
    console.log('YOUTUBE_API_KEY:', !!process.env.YOUTUBE_API_KEY ? 'SET' : 'NOT SET');
    return 'amplify-build-' + Date.now();
  },
};

export default nextConfig;
