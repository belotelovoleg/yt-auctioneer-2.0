import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET_ENCODED = new TextEncoder().encode(process.env.JWT_SECRET!);

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

// GET /api/auctions - Get user's auctions
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auctions = await prisma.auction.findMany({
      where: {
        userId: user.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(auctions);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auctions' },
      { status: 500 }
    );
  }
}

// POST /api/auctions - Create new auction
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const { name, description, date, youtubeChannelId, youtubeVideoId, useTimer } = await request.json();

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Require at least one YouTube identifier for live chat functionality
    if (!youtubeChannelId && !youtubeVideoId) {
      return NextResponse.json(
        { error: 'At least one of YouTube Channel ID or YouTube Video ID is required for live chat functionality' },
        { status: 400 }
      );
    }    const auction = await prisma.auction.create({
      data: {
        userId: user.userId,
        name,
        description: description || '',
        ...(date && { date: new Date(date) }),
        youtubeChannelId: youtubeChannelId || null,
        youtubeVideoId: youtubeVideoId || null,
        useTimer: useTimer !== undefined ? useTimer : true,
        status: 'SCHEDULED',
      },
    });

    return NextResponse.json(auction, { status: 201 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create auction' },
      { status: 500 }
    );
  }
}

