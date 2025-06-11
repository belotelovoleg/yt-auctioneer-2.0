import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Ensure environment variables are available in serverless functions
  serverExternalPackages: ['@prisma/client'],
    // Define which environment variables should be available in the browser (if any)
  // Note: Only put non-sensitive variables here
  env: {
    // AWS Amplify sometimes needs these for proper SSR handling
    NODE_ENV: process.env.NODE_ENV,
    // Add any client-side environment variables here if needed
    // NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  
  // Server-side environment variables (these stay server-side)
  serverRuntimeConfig: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  },
};

export default nextConfig;
