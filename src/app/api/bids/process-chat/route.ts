import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';
import { BidProcessingService } from '@/lib/bidProcessing';

// POST /api/bids/process-chat - Process YouTube chat bids
export async function POST(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { auctionId, lotId, chatBids } = body;

    if (!auctionId || !lotId || !Array.isArray(chatBids)) {
      return NextResponse.json(
        { error: 'Missing required fields: auctionId, lotId, chatBids' },
        { status: 400 }
      );
    }

    // Process the chat bids
    const result = await BidProcessingService.processYouTubeBids(
      parseInt(auctionId),
      parseInt(lotId),
      chatBids
    );

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error processing chat bids:', error);
    return NextResponse.json(
      { error: 'Failed to process chat bids' },
      { status: 500 }
    );
  }
}
