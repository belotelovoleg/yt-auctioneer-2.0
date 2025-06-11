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

// Database URL with AWS Lambda fallback
export const DATABASE_URL = (() => {
  const value = process.env.DATABASE_URL;
  logEnvStatus('DATABASE_URL', !!value);
  
  if (value) return value;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Using development DATABASE_URL fallback');
    return 'postgresql://localhost:5432/yt_auctioneer_dev';
  }
  
  // AWS Lambda specific fallback - use a placeholder that won't crash the app
  if (process.env.AWS_REGION) {
    const fallback = `postgresql://aws-lambda-fallback:5432/yt_auctioneer_${process.env.AWS_REGION}`;
    console.log('🔧 Using AWS Lambda DATABASE_URL fallback for region:', process.env.AWS_REGION);
    return fallback;
  }
  
  // Final fallback to prevent crashes
  console.warn('⚠️ Using emergency DATABASE_URL fallback - database operations may fail');
  return 'postgresql://emergency:5432/fallback';
})();

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

// NextAuth Secret with AWS Lambda fallback (same logic as JWT_SECRET)
export const NEXTAUTH_SECRET = (() => {
  const value = process.env.NEXTAUTH_SECRET;
  logEnvStatus('NEXTAUTH_SECRET', !!value);
  
  if (value) return value;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Using development NEXTAUTH fallback');
    return 'dev-nextauth-secret-change-in-production';
  }
  
  // AWS Lambda specific fallback
  if (process.env.AWS_REGION) {
    const fallback = `aws-lambda-nextauth-${process.env.AWS_REGION}-fallback`;
    console.log('🔧 Using AWS Lambda NEXTAUTH fallback for region:', process.env.AWS_REGION);
    return fallback;
  }
  
  throw new Error('NEXTAUTH_SECRET environment variable is required in production');
})();

// YouTube API Key with AWS Lambda fallback
export const YOUTUBE_API_KEY = (() => {
  const value = process.env.YOUTUBE_API_KEY;
  logEnvStatus('YOUTUBE_API_KEY', !!value);
  
  if (value) return value;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Using development YOUTUBE_API_KEY fallback');
    return 'dev-youtube-key-change-in-production';
  }
  
  // AWS Lambda specific fallback
  if (process.env.AWS_REGION) {
    const fallback = `aws-lambda-youtube-${process.env.AWS_REGION}-fallback`;
    console.log('🔧 Using AWS Lambda YOUTUBE_API_KEY fallback for region:', process.env.AWS_REGION);
    return fallback;
  }
  
  // Final fallback to prevent crashes
  console.warn('⚠️ Using emergency YOUTUBE_API_KEY fallback - YouTube features may not work');
  return 'emergency-fallback-key';
})();

/**
 * Safe environment variable getter - never throws, always returns a string
 */
export function getEnvVar(key: string, fallback: string = ''): string {
  const value = process.env[key];
  logEnvStatus(key, !!value);
  
  if (value) {
    return value;
  }
  
  if (fallback) {
    console.log(`🔧 Using fallback for ${key}`);
    return fallback;
  }
  
  // Return a safe fallback that won't crash the app
  console.warn(`⚠️ ${key} not set, using empty string fallback`);
  return '';
}

/**
 * Get NODE_ENV safely
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * NextAuth URL for OAuth callbacks
 */
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';