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
};

export default nextConfig;
