import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateToken } from '@/lib/auth-server';

// GET /api/bids - Get all bids for a specific auction/lot
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auctionId = searchParams.get('auctionId');
    const lotId = searchParams.get('lotId');

    if (!auctionId || !lotId) {
      return NextResponse.json(
        { error: 'Missing auctionId or lotId parameter' },
        { status: 400 }
      );
    }    const bids = await prisma.bid.findMany({
      where: {
        auctionId: parseInt(auctionId),
        lotId: parseInt(lotId),
      },
      orderBy: [
        { amount: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        user: {
          select: {
            id: true,
            login: true,
          }
        }
      }
    });

    return NextResponse.json({ bids });
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}

// POST /api/bids - Create a new bid
export async function POST(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      auctionId,
      lotId,
      bidderName,
      bidderEmail,
      amount,
      source = 'MANUAL',
      messageId,
      metadata
    } = body;

    // Validate required fields
    if (!auctionId || !lotId || !bidderName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: auctionId, lotId, bidderName, amount' },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid bid amount' },
        { status: 400 }
      );
    }

    // Get lot information for validation
    const lot = await prisma.lot.findUnique({
      where: { id: parseInt(lotId) }
    });

    if (!lot) {
      return NextResponse.json(
        { error: 'Lot not found' },
        { status: 404 }
      );
    }    // Get current highest bid for this lot
    const currentHighestBid = await prisma.bid.findFirst({
      where: {
        auctionId: parseInt(auctionId),
        lotId: parseInt(lotId),
        status: 'ACCEPTED'
      },
      orderBy: { amount: 'desc' }
    });

    // Calculate calculated price (starting price - discount)
    const startingPrice = parseFloat(lot.startingPrice.toString());
    const discount = parseFloat(lot.discount?.toString() || '0');
    const calculatedPrice = startingPrice - discount;

    // Calculate minimum bid amount
    const currentPrice = currentHighestBid ? 
      parseFloat(currentHighestBid.amount.toString()) : 
      calculatedPrice;
    
    // For first bid, minimum is calculated price; for subsequent bids, it's current + step
    const minBidAmount = currentHighestBid ? 
      currentPrice + parseFloat(lot.priceStep.toString()) : 
      calculatedPrice;

    // Validate bid amount meets minimum requirements
    if (bidAmount < minBidAmount) {
      return NextResponse.json(
        { 
          error: 'Bid too low',
          currentPrice,
          minBidAmount,
          bidStep: parseFloat(lot.priceStep.toString())
        },
        { status: 400 }
      );
    }

    // Check for duplicate YouTube bids
    if (source === 'YOUTUBE' && messageId) {
      const existingBid = await prisma.bid.findFirst({
        where: { messageId }
      });

      if (existingBid) {
        return NextResponse.json(
          { error: 'Bid already processed', bid: existingBid },
          { status: 409 }
        );
      }
    }

    // Create the bid in a transaction to handle concurrent bids
    const result = await prisma.$transaction(async (tx) => {      // Mark previous winning bids as outbid
      await (tx as any).bid.updateMany({
        where: {
          auctionId: parseInt(auctionId),
          lotId: parseInt(lotId),
          isWinning: true
        },
        data: {
          isWinning: false,
          status: 'OUTBID'
        }
      });      // Create new bid
      const newBid = await (tx as any).bid.create({
        data: {
          auctionId: parseInt(auctionId),
          lotId: parseInt(lotId),
          bidderName,
          bidderEmail,
          amount: bidAmount,
          source: source as 'MANUAL' | 'YOUTUBE' | 'PHONE' | 'ONLINE',
          status: 'ACCEPTED',
          isWinning: true,
          messageId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
        include: {
          user: {
            select: {
              id: true,
              login: true,
            }
          }
        }
      });

      return newBid;
    });

    return NextResponse.json({ bid: result });
  } catch (error) {
    console.error('Error creating bid:', error);
    return NextResponse.json(
      { error: 'Failed to create bid' },
      { status: 500 }
    );
  }
}
