import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envDebug = {
      NODE_ENV: process.env.NODE_ENV,
      AWS_REGION: process.env.AWS_REGION,
      AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
      _HANDLER: process.env._HANDLER,
      
      // Check if our variables exist (without revealing values)
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
      JWT_SECRET_EXISTS: !!process.env.JWT_SECRET,
      NEXTAUTH_SECRET_EXISTS: !!process.env.NEXTAUTH_SECRET,
      YOUTUBE_API_KEY_EXISTS: !!process.env.YOUTUBE_API_KEY,
      
      // Show first few chars for debugging (if they exist)
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 20) + '...',
      JWT_SECRET_PREFIX: process.env.JWT_SECRET?.substring(0, 10) + '...',
      NEXTAUTH_SECRET_PREFIX: process.env.NEXTAUTH_SECRET?.substring(0, 10) + '...',
      YOUTUBE_API_KEY_PREFIX: process.env.YOUTUBE_API_KEY?.substring(0, 10) + '...',
      
      // All environment variable names (for debugging)
      ALL_ENV_KEYS: Object.keys(process.env).sort(),
      
      // Amplify specific variables
      AMPLIFY_VARIABLES: Object.keys(process.env).filter(key => 
        key.includes('AMPLIFY') || 
        key.includes('AWS') || 
        key.includes('LAMBDA')
      ),
    };

    return NextResponse.json({ 
      success: true, 
      debug: envDebug,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
