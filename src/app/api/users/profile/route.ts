import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/config-env';

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_ENCODED);
    return payload as { userId: number; login: string };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// GET /api/users/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.user.findUnique({
      where: {
        id: user.userId,
      },
      select: {
        id: true,
        login: true,
        youtubeChannelId: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// PUT /api/users/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { youtubeChannelId } = await request.json();

    const updatedProfile = await prisma.user.update({
      where: {
        id: user.userId,
      },
      data: {
        youtubeChannelId: youtubeChannelId?.trim() || null,
      },
      select: {
        id: true,
        login: true,
        youtubeChannelId: true,
      },
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

