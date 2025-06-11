import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getEnvVar } from '@/lib/env-config';

const JWT_SECRET = new TextEncoder().encode(
  getEnvVar('JWT_SECRET')
);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; login: string };
  } catch {
    return null;
  }
}

// GET /api/auctions/[id] - Get auction details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const auctionId = parseInt(id);
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: 'Invalid auction ID' }, { status: 400 });
    }

    // Get auction with its lots
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
      include: {
        auctionLots: {
          include: {
            lot: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Add calculatedPrice to lots
    const auctionWithCalculatedPrice = {
      ...auction,
      auctionLots: auction.auctionLots.map(al => ({
        ...al,
        lot: {
          ...al.lot,
          calculatedPrice: Math.max(0, Number(al.lot.startingPrice) - Number(al.lot.discount))
        }
      }))
    };

    return NextResponse.json(auctionWithCalculatedPrice);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction' },
      { status: 500 }
    );
  }
}

// PUT /api/auctions/[id] - Update auction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const auctionId = parseInt(id);
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: 'Invalid auction ID' }, { status: 400 });
    }

    // Check if auction belongs to user
    const existingAuction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!existingAuction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
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
    }    const auction = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        name,
        description: description || '',
        ...(date && { date: new Date(date) }),
        youtubeChannelId: youtubeChannelId || null,
        youtubeVideoId: youtubeVideoId || null,
        ...(useTimer !== undefined && { useTimer }),
        // Note: status is not updatable by user, only by system
      },
    });

    return NextResponse.json(auction);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update auction' },
      { status: 500 }
    );
  }
}

// PATCH /api/auctions/[id] - Update auction (e.g., discount pool)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const auctionId = parseInt(id);    if (isNaN(auctionId)) {
      return NextResponse.json({ error: 'Invalid auction ID' }, { status: 400 });
    }    const body = await request.json();
    const { discountPool, discountUsed, useTimer } = body;

    console.log('📊 PATCH /api/auctions/[id] - Received body:', body);
    console.log('📊 discountPool:', discountPool, typeof discountPool);
    console.log('📊 discountUsed:', discountUsed, typeof discountUsed);
    console.log('📊 useTimer:', useTimer, typeof useTimer);

    // Validate discount pool value
    if (discountPool !== undefined && (typeof discountPool !== 'number' || discountPool < 0)) {
      console.log('❌ Invalid discount pool value:', discountPool);
      return NextResponse.json({ error: 'Invalid discount pool value' }, { status: 400 });
    }

    // Validate discount used value
    if (discountUsed !== undefined && (typeof discountUsed !== 'number' || discountUsed < 0)) {
      console.log('❌ Invalid discount used value:', discountUsed);
      return NextResponse.json({ error: 'Invalid discount used value' }, { status: 400 });
    }

    // Check if auction belongs to user
    const existingAuction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!existingAuction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }    // Update auction
    const updateData: any = {};
    if (discountPool !== undefined) {
      updateData.discountPool = discountPool;
    }
    if (discountUsed !== undefined) {
      updateData.discountUsed = discountUsed;
    }
    if (useTimer !== undefined) {
      updateData.useTimer = useTimer;
    }    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: updateData,
      include: {
        auctionLots: {
          include: {
            lot: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    // Add calculatedPrice to lots
    const auctionWithCalculatedPrice = {
      ...updatedAuction,
      auctionLots: updatedAuction.auctionLots.map(al => ({
        ...al,
        lot: {
          ...al.lot,
          calculatedPrice: Math.max(0, Number(al.lot.startingPrice) - Number(al.lot.discount))
        }
      }))
    };

    return NextResponse.json(auctionWithCalculatedPrice);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update auction' },
      { status: 500 }
    );
  }
}

// DELETE /api/auctions/[id] - Delete auction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const auctionId = parseInt(id);
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: 'Invalid auction ID' }, { status: 400 });
    }

    // Check if auction belongs to user
    const existingAuction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!existingAuction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    await prisma.auction.delete({
      where: { id: auctionId },
    });

    return NextResponse.json({ message: 'Auction deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to delete auction' },
      { status: 500 }
    );
  }
}
