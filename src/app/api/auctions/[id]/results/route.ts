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
    return payload as { userId: number };
  } catch (error) {
    return null;
  }
}

// GET /api/auctions/[id]/results - Get auction results
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

    // Get auction with sold lots only
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
          where: {
            lot: {
              status: 'SOLD',
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.status !== 'FINISHED') {
      return NextResponse.json({ 
        error: 'Auction must be finished to view results' 
      }, { status: 400 });
    }

    // Get all winning bids for sold lots in this auction
    const winningBids = await prisma.bid.findMany({
      where: {
        auctionId: auctionId,
        isWinning: true,
        status: 'ACCEPTED',
        lot: {
          status: 'SOLD',
        },
      },
      include: {
        lot: {
          select: {
            id: true,
            name: true,
            description: true,
            photo: true,
            startingPrice: true,
            finalPrice: true,
            status: true,
          },
        },
      },
      orderBy: {
        amount: 'desc',
      },
    });

    // Get total bid count for this auction
    const totalBids = await prisma.bid.count({
      where: {
        auctionId: auctionId,
      },
    });

    // Calculate summary statistics
    const totalSoldLots = auction.auctionLots.length;
    const totalRevenue = winningBids.reduce((sum, bid) => sum + Number(bid.amount), 0);
    const uniqueBidders = new Set(winningBids.map(bid => bid.bidderName)).size;

    // Create buyer summary
    const buyerMap = new Map();
    winningBids.forEach(bid => {
      const name = bid.bidderName;
      if (!buyerMap.has(name)) {
        buyerMap.set(name, {
          bidderName: name,
          totalSpent: 0,
          lotsWon: 0,
          bids: [],
        });
      }
      const buyer = buyerMap.get(name);
      buyer.totalSpent += Number(bid.amount);
      buyer.lotsWon += 1;
      buyer.bids.push(bid);
    });

    const buyerSummary = Array.from(buyerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

    const results = {
      auction: {
        id: auction.id,
        name: auction.name,
        status: auction.status,
        auctionLots: auction.auctionLots.map(al => ({
          ...al,
          lot: {
            ...al.lot,
            calculatedPrice: Math.max(0, Number(al.lot.startingPrice) - Number(al.lot.discount))
          }
        })),
      },
      soldLots: auction.auctionLots,
      winningBids,
      totalSoldLots,
      totalBids,
      totalRevenue,
      uniqueBidders,
      buyerSummary,
    };

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error fetching auction results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction results' },
      { status: 500 }
    );
  }
}
