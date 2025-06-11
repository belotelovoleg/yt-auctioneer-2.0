import { NextRequest, NextResponse } from 'next/server';
import { BidProcessingService } from '@/lib/bidProcessing';

// POST /api/test/timestamp-filtering - Test timestamp filtering for old messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auctionId, lotId, testBids } = body;

    console.log('🧪 Testing timestamp filtering...');
    console.log(`📊 Test bids:`, testBids.map((bid: any) => `${bid.authorName} (${bid.amount}) at ${bid.timestamp}`));

    const result = await BidProcessingService.processYouTubeBids(
      parseInt(auctionId),
      parseInt(lotId),
      testBids
    );

    return NextResponse.json({
      success: true,
      result: {
        processed: result.processed,
        created: result.created,
        errors: result.errors,
        currentWinningBid: result.currentWinningBid
      },
      message: `Timestamp filtering test completed. ${result.created} bids created from ${testBids.length} test messages.`
    });

  } catch (error) {
    console.error('Error in timestamp filtering test:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
