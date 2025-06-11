import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';
import { BidProcessingService } from '@/lib/bidProcessing';

// POST /api/bids/manual - Create a manual bid
export async function POST(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { auctionId, lotId, bidderName, amount, bidderEmail } = body;

    if (!auctionId || !lotId || !bidderName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: auctionId, lotId, bidderName, amount' },
        { status: 400 }
      );
    }

    // Create the manual bid
    const result = await BidProcessingService.createManualBid(
      parseInt(auctionId),
      parseInt(lotId),
      bidderName,
      parseFloat(amount),
      bidderEmail
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bid: result.bid
    });

  } catch (error) {
    console.error('Error creating manual bid:', error);
    return NextResponse.json(
      { error: 'Failed to create manual bid' },
      { status: 500 }
    );
  }
}
