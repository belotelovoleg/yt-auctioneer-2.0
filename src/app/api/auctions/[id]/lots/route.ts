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
    
    // Get auction with its lots ordered by the order field
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
    
    // Calculate the total used discount from all lots
    const totalDiscountUsed = auction.auctionLots.reduce((sum, auctionLot) => {
      return sum + Number(auctionLot.lot.discount || 0);
    }, 0);

    return NextResponse.json({
      id: auction.id,
      name: auction.name,
      status: auction.status,
      youtubeVideoId: auction.youtubeVideoId,
      youtubeChannelId: auction.youtubeChannelId,
      discountPool: auction.discountPool,
      discountUsed: totalDiscountUsed, // Use the calculated total discount instead of the stored value
      auctionLots: auction.auctionLots.map(al => ({
        id: al.id,
        order: al.order,
        lot: {
          ...al.lot,
          calculatedPrice: Math.max(0, Number(al.lot.startingPrice) - Number(al.lot.discount))
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching auction lots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lotIds } = await request.json();
    const { id } = await params;
    const auctionId = parseInt(id);

    if (!Array.isArray(lotIds) || lotIds.length === 0) {
      return NextResponse.json(
        { error: 'lotIds must be a non-empty array' },
        { status: 400 }
      );
    }    // Verify auction ownership
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Verify lot ownership
    const lots = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
        userId: user.userId,
      },
    });

    if (lots.length !== lotIds.length) {
      return NextResponse.json(
        { error: 'Some lots not found or not owned by user' },
        { status: 400 }
      );
    }

    // Get current max order for this auction
    const maxOrderResult = await prisma.auctionLot.aggregate({
      where: { auctionId },
      _max: { order: true },
    });

    let nextOrder = (maxOrderResult._max.order || 0) + 1;    // Create auction-lot relationships
    const auctionLots = await Promise.all(
      lotIds.map(async (lotId: number) => {
        // Check if relationship already exists
        const existing = await prisma.auctionLot.findUnique({
          where: {
            auctionId_lotId: {
              auctionId,
              lotId,
            },
          },
        });

        if (existing) {
          return existing;
        }

        // When adding lot to auction, inherit auction's useTimer setting
        await prisma.lot.update({
          where: { id: lotId },
          data: { useTimer: auction.useTimer },
        });

        return await prisma.auctionLot.create({
          data: {
            auctionId,
            lotId,
            order: nextOrder++,
          },
          include: {
            lot: true,
          },
        });
      })
    );

    return NextResponse.json(auctionLots);
  } catch (error) {
    console.error('Error adding lots to auction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { updates } = await request.json();
    const { id } = await params;
    const auctionId = parseInt(id);

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates must be an array' },
        { status: 400 }
      );
    }

    // Verify auction ownership
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Update order for each lot
    await Promise.all(
      updates.map(async ({ id, order }: { id: number; order: number }) => {
        return await prisma.auctionLot.update({
          where: {
            id,
            auctionId, // Ensure it belongs to this auction
          },
          data: { order },
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lot orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { auctionLotId } = await request.json();
    const { id } = await params;
    const auctionId = parseInt(id);

    if (!auctionLotId) {
      return NextResponse.json(
        { error: 'auctionLotId is required' },
        { status: 400 }
      );
    }

    // Verify auction ownership
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Get the auction lot to find the related lot ID
    const auctionLot = await prisma.auctionLot.findFirst({
      where: {
        id: auctionLotId,
        auctionId,
      },
    });

    if (!auctionLot) {
      return NextResponse.json({ error: 'Auction lot not found' }, { status: 404 });
    }    // Remove lot from auction (no longer clearing discount values)
    await prisma.auctionLot.delete({
      where: {
        id: auctionLotId,
        auctionId, // Ensure it belongs to this auction
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing lot from auction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
