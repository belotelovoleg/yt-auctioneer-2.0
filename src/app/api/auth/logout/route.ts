import { NextResponse } from 'next/server';
import { NODE_ENV } from '@/lib/config-env';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  
  // Clear the auth token cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
  });
  
  return response;
}
