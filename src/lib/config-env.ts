/**
 * Environment configuration for AWS Amplify
 * Handles AWS Lambda environment variable loading with .env.production fallback
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.production if process.env doesn't have them
let productionEnvVars: Record<string, string> = {};

// Try to load .env.production file as fallback for AWS Lambda
if (typeof window === 'undefined') {
  try {
    const envProductionPath = path.join(process.cwd(), '.env.production');
    if (fs.existsSync(envProductionPath)) {
      const envContent = fs.readFileSync(envProductionPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            // Join the value parts and remove surrounding quotes
            const rawValue = valueParts.join('=');
            const cleanValue = rawValue.replace(/^["']|["']$/g, '').trim();
            productionEnvVars[key] = cleanValue;
          }
        }
      }
      
      console.log(`📁 Loaded ${Object.keys(productionEnvVars).length} variables from .env.production`);
    } else {
      console.log('📁 No .env.production file found');
    }
  } catch (error) {
    console.warn('⚠️ Failed to load .env.production:', error);
  }
}

// Helper function to get environment variable with .env.production fallback
function getEnvVar(key: string, fallback: string = ''): string {
  // First try process.env
  let value = process.env[key];
  
  // If not found, try .env.production
  if (!value && productionEnvVars[key]) {
    value = productionEnvVars[key];
    console.log(`🔧 Using .env.production value for ${key}`);
  }
  
  // Clean the value by removing surrounding quotes
  if (value) {
    value = value.replace(/^["']|["']$/g, '').trim();
  }
  
  if (typeof window === 'undefined') {
    console.log(`🔍 ${key}:`, value ? 'SET' : 'NOT SET');
  }
  
  return value || fallback;
}

// Log overall environment status
if (typeof window === 'undefined') {
  console.log('🌍 Environment:', process.env.NODE_ENV || 'unknown');
  console.log('🔍 AWS Region:', process.env.AWS_REGION || 'Not set');
  console.log('🔍 Total process.env vars:', Object.keys(process.env).length);
  console.log('🔍 Total .env.production vars:', Object.keys(productionEnvVars).length);
}

// Export environment variables using the new helper function
export const DATABASE_URL = getEnvVar('DATABASE_URL', 'postgresql://localhost:5432/yt_auctioneer_dev');
export const JWT_SECRET = getEnvVar('JWT_SECRET', 'dev-jwt-secret-change-in-production');
export const NEXTAUTH_SECRET = getEnvVar('NEXTAUTH_SECRET', 'dev-nextauth-secret-change-in-production');
export const YOUTUBE_API_KEY = getEnvVar('YOUTUBE_API_KEY', 'dev-youtube-key-change-in-production');
export const NODE_ENV = getEnvVar('NODE_ENV', 'development');
export const NEXTAUTH_URL = getEnvVar('NEXTAUTH_URL', 'http://localhost:3000');

// Export the helper function for other uses
export { getEnvVar };