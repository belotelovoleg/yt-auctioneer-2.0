import { NextRequest, NextResponse } from 'next/server';
import { BidProcessingService } from '@/lib/bidProcessing';

// POST /api/test/simulate-bid - Simulate a YouTube chat bid for testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auctionId, lotId, bidderName, amount } = body;

    if (!auctionId || !lotId || !bidderName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: auctionId, lotId, bidderName, amount' },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing background bid processing for Auction ${auctionId}, Lot ${lotId}`);

    // Simulate a YouTube chat bid
    const simulatedChatBids = [{
      authorName: bidderName,
      authorPhotoUrl: 'https://example.com/avatar.jpg',
      timestamp: new Date().toISOString(),
      amount: parseFloat(amount),
      messageId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }];

    // Process the simulated bid through the background system
    const result = await BidProcessingService.processYouTubeBids(
      parseInt(auctionId),
      parseInt(lotId),
      simulatedChatBids
    );

    console.log('🎯 Background processing result:', result);

    return NextResponse.json({
      success: true,
      message: `Simulated bid from ${bidderName} for ${amount}`,
      result: result
    });

  } catch (error) {
    console.error('❌ Error simulating bid:', error);
    return NextResponse.json(
      { error: 'Failed to simulate bid' },
      { status: 500 }
    );
  }
}
