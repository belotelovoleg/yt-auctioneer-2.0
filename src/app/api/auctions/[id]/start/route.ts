import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { YouTubeService } from '@/lib/youtube';
import { jwtVerify } from 'jose';
import { getEnvVar } from '@/lib/config-env';

const JWT_SECRET = new TextEncoder().encode(
  getEnvVar('JWT_SECRET')
);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; login: string };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// POST /api/auctions/[id]/start - Start auction and verify YouTube live stream
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
    }    // Get auction with lots
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        youtubeChannelId: true,
        youtubeVideoId: true,
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

    // Check if auction is in SCHEDULED status
    if (auction.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Auction must be in SCHEDULED status to start' },
        { status: 400 }
      );
    }

    // Check if auction has lots
    if (auction.auctionLots.length === 0) {
      return NextResponse.json(
        { error: 'Auction must have at least one lot to start' },
        { status: 400 }
      );
    }    // Verify YouTube live stream
    let liveChatId: string | null = null;
    let videoIdToUse: string | null = null;
    
    try {
      // Prefer youtubeVideoId if available, fallback to youtubeChannelId
      if (auction.youtubeVideoId) {
        console.log(`🎥 Using Video ID: ${auction.youtubeVideoId}`);
        videoIdToUse = auction.youtubeVideoId;
      } else if (auction.youtubeChannelId) {
        console.log(`📺 Using Channel ID: ${auction.youtubeChannelId}, finding live video...`);
        videoIdToUse = await YouTubeService.getLiveVideoIdFromChannel(auction.youtubeChannelId);
        
        if (!videoIdToUse) {
          return NextResponse.json(
            { error: 'No active live stream found for this YouTube channel. Please start a live stream or provide a specific video ID.' },
            { status: 400 }
          );
        }
        
        console.log(`✅ Found live video: ${videoIdToUse}`);
      } else {
        return NextResponse.json(
          { error: 'No YouTube Video ID or Channel ID provided' },
          { status: 400 }
        );
      }
      
      // Now get the live chat ID using the video ID
      liveChatId = await YouTubeService.getLiveChatId(videoIdToUse);
    } catch (error) {
      console.error('YouTube API error:', error);
      return NextResponse.json(
        { error: 'Failed to verify YouTube live stream. Please check the video/channel ID and ensure there\'s an active live stream.' },
        { status: 400 }
      );
    }

    if (!liveChatId) {
      return NextResponse.json(
        { error: 'No active live stream found for the provided video ID' },
        { status: 400 }
      );
    }

    // Update auction status to READY
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'READY' },
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

    return NextResponse.json({
      auction: updatedAuction,
      liveChatId,
      message: 'Auction started successfully! YouTube live stream verified.',
    });

  } catch (error) {
    console.error('Error starting auction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
