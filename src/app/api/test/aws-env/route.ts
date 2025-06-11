import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint will help us debug AWS environment variables
  const envDebug = {
    // Environment info
    NODE_ENV: process.env.NODE_ENV,
    
    // AWS specific
    AWS_REGION: process.env.AWS_REGION,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    AWS_LAMBDA_FUNCTION_VERSION: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    
    // Our required variables (existence only, no values)
    vars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    },
    
    // First few characters (safe to show)
    prefixes: {
      DATABASE_URL: process.env.DATABASE_URL?.substring(0, 12) + '...',
      JWT_SECRET: process.env.JWT_SECRET?.substring(0, 3) + '...',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET?.substring(0, 3) + '...',
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY?.substring(0, 6) + '...',
    },
    
    // Count of all environment variables
    totalEnvVars: Object.keys(process.env).length,
    
    // Environment variable names containing our keywords
    relevantKeys: Object.keys(process.env).filter(key => 
      key.includes('DATABASE') || 
      key.includes('JWT') || 
      key.includes('NEXTAUTH') || 
      key.includes('YOUTUBE') ||
      key.includes('AMPLIFY')
    ).sort(),
    
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(envDebug);
}
