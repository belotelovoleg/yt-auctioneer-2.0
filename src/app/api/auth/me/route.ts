import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const user = await validateToken(request);
    
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        login: user.login,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
