import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getEnvVar } from '@/lib/env-config';

const JWT_SECRET = new TextEncoder().encode(
  getEnvVar('JWT_SECRET')
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Login attempt started');    console.log('🔍 Environment check:', {
      NODE_ENV: getEnvVar('NODE_ENV'),
      DATABASE_URL: getEnvVar('DATABASE_URL') ? 'SET' : 'NOT SET',
      JWT_SECRET: getEnvVar('JWT_SECRET') ? 'SET' : 'NOT SET'
    });

    const { login, password } = await request.json();
    console.log('🔍 Request body parsed, login:', login);
    
    if (!login || !password) {
      console.log('❌ Missing login or password');
      return NextResponse.json(
        { error: 'Login and password are required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Attempting database connection...');
    // Find user by login
    const user = await prisma.user.findUnique({
      where: { login },
    });
    console.log('🔍 Database query completed, user found:', !!user);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      );
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Create JWT token
    const token = await new SignJWT({ 
      userId: user.id, 
      login: user.login 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(JWT_SECRET);
      // Create response with token in httpOnly cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        login: user.login,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
      },
    });
      response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: getEnvVar('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    
    return response;  } catch (error) {
    console.error('❌ Login error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
