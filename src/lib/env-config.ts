/**
 * Environment configuration for AWS Amplify
 * Handles AWS Lambda environment variable loading properly
 */

// Helper function to safely log environment status
function logEnvStatus(key: string, exists: boolean) {
  if (typeof window === 'undefined') { // Server-side only
    console.log(`🔍 ${key}:`, exists ? 'SET' : 'NOT SET');
  }
}

// Helper function to get environment variable with detailed logging
function getEnvWithFallback(key: string, devFallback: string, prodRequired: boolean = true) {
  const value = process.env[key];
  logEnvStatus(key, !!value);
  
  if (value) {
    return value;
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 Using development fallback for ${key}`);
    return devFallback;
  }
  
  // Production environment
  if (prodRequired) {
    console.error(`❌ ${key} is required in production but not set`);
    throw new Error(`${key} environment variable is required in production`);
  }
  
  return devFallback;
}

// Log overall environment status
if (typeof window === 'undefined') {
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('🔍 AWS Region:', process.env.AWS_REGION || 'Not set');
  console.log('🔍 Total env vars:', Object.keys(process.env).length);
}

// Database URL
export const DATABASE_URL = getEnvWithFallback(
  'DATABASE_URL',
  'postgresql://localhost:5432/yt_auctioneer_dev',
  true
);

// JWT Secret with AWS Lambda fallback
export const JWT_SECRET = (() => {
  const value = process.env.JWT_SECRET;
  logEnvStatus('JWT_SECRET', !!value);
  
  if (value) return value;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Using development JWT fallback');
    return 'dev-jwt-secret-change-in-production';
  }
  
  // AWS Lambda specific fallback
  if (process.env.AWS_REGION) {
    const fallback = `aws-lambda-jwt-${process.env.AWS_REGION}-fallback`;
    console.log('🔧 Using AWS Lambda JWT fallback for region:', process.env.AWS_REGION);
    return fallback;
  }
  
  throw new Error('JWT_SECRET environment variable is required in production');
})();

// NextAuth Secret
export const NEXTAUTH_SECRET = getEnvWithFallback(
  'NEXTAUTH_SECRET',
  'dev-nextauth-secret-change-in-production',
  true
);

// YouTube API Key
export const YOUTUBE_API_KEY = getEnvWithFallback(
  'YOUTUBE_API_KEY',
  'dev-youtube-key-change-in-production',
  true
);

/**
 * Helper function for getting environment variables with fallbacks
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  
  if (value) {
    return value;
  }
  
  if (fallback !== undefined) {
    return fallback;
  }
  
  throw new Error(`Environment variable ${key} is required but not set`);
}
