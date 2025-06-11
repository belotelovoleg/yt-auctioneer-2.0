import { NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env-config';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  
  // Clear the auth token cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: getEnvVar('NODE_ENV') === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
  });
  
  return response;
}
