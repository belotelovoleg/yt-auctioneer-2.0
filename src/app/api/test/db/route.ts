import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getEnvVar } from '@/lib/env-config';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...');
    console.log('🔍 Environment:', {
      NODE_ENV: getEnvVar('NODE_ENV'),
      DATABASE_URL: getEnvVar('DATABASE_URL') ? 'SET' : 'NOT SET'
    });

    // Simple database test
    const userCount = await prisma.user.count();
    console.log('✅ Database connection successful, user count:', userCount);

    return NextResponse.json({
      status: 'success',
      database: 'connected',
      userCount,
      environment: getEnvVar('NODE_ENV'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database connection failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });

    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
