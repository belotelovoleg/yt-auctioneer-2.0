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
    return payload as { userId: number };
  } catch (error) {
    return null;
  }
}

// POST /api/auctions/[id]/finish - Finish an auction
export async function POST(
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

    // Check if auction belongs to user and is in the right status
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
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.status !== 'READY' && auction.status !== 'STARTED') {
      return NextResponse.json({ 
        error: 'Can only finish auctions that are READY or STARTED' 
      }, { status: 400 });
    }

    // Perform the finishing operations in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Change status of any currently selling lots back to READY
      const lotsToMakeReady = auction.auctionLots
        .filter(al => al.lot.status === 'BEING_SOLD')
        .map(al => al.lot.id);

      if (lotsToMakeReady.length > 0) {
        await prisma.lot.updateMany({
          where: {
            id: { in: lotsToMakeReady },
          },
          data: {
            status: 'READY',
            sellingStartedAt: null,
          },
        });
      }

      // 2. Remove all non-SOLD lots from the auction
      const soldLotIds = auction.auctionLots
        .filter(al => al.lot.status === 'SOLD')
        .map(al => al.id);

      const lotIdsToRemove = auction.auctionLots
        .filter(al => al.lot.status !== 'SOLD')
        .map(al => al.id);

      if (lotIdsToRemove.length > 0) {
        await prisma.auctionLot.deleteMany({
          where: {
            id: { in: lotIdsToRemove },
          },
        });
      }

      // 3. Update auction status to FINISHED
      const updatedAuction = await prisma.auction.update({
        where: { id: auctionId },
        data: {
          status: 'FINISHED',
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
      });

      return {
        auction: updatedAuction,
        soldLotsCount: soldLotIds.length,
        removedLotsCount: lotIdsToRemove.length,
        readyLotsCount: lotsToMakeReady.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Auction finished successfully',
      ...result,
    });

  } catch (error) {
    console.error('Error finishing auction:', error);
    return NextResponse.json(
      { error: 'Failed to finish auction' },
      { status: 500 }
    );
  }
}
