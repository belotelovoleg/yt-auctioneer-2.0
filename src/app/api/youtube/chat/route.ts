import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/youtube';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/config-env';

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

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

// GET /api/youtube/chat?videoId=xxx&pageToken=xxx OR channelId=xxx&pageToken=xxx - Get YouTube live chat messages
export async function GET(request: NextRequest) {
  try {
    // Check for internal call header (bypass auth for server-side calls)
    const isInternalCall = request.headers.get('x-internal-call') === 'true';
    
    if (!isInternalCall) {
      const user = await getUserFromToken(request);
      if (!user) {
        console.log('YouTube Chat API: Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    let videoId = searchParams.get('videoId');
    const channelId = searchParams.get('channelId');
    const pageToken = searchParams.get('pageToken');

    // If no videoId provided, try to get it from channelId
    if (!videoId && channelId) {
      videoId = await YouTubeService.getLiveVideoIdFromChannel(channelId);
      
      if (!videoId) {
        return NextResponse.json(
          { error: 'No live video found for this channel' },
          { status: 404 }
        );
      }
    }

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId or channelId parameter is required' },
        { status: 400 }
      );
    }

    // First, get the live chat ID
    const liveChatId = await YouTubeService.getLiveChatId(videoId);
    
    if (!liveChatId) {
      return NextResponse.json(
        { error: 'No active live stream found for this video ID' },
        { status: 404 }
      );
    }

    // Get chat messages
    const chatData = await YouTubeService.getChatMessages(liveChatId, pageToken || undefined);    
    // Extract bids from messages
    const bids = YouTubeService.extractBids(chatData.messages);

    // Transform messages to simplified format for frontend
    const transformedMessages = chatData.messages.map(msg => ({
      authorName: msg.authorDetails?.displayName || 'Unknown User',
      authorPhotoUrl: msg.authorDetails?.profileImageUrl || '',
      timestamp: msg.snippet?.publishedAt || new Date().toISOString(),
      message: msg.snippet?.textMessageDetails?.messageText || '',
      messageId: msg.id
    }));

    // Transform bids to the expected format
    const transformedBids = bids.map(bid => ({
      authorName: bid.user.name,
      authorPhotoUrl: bid.user.avatar,
      timestamp: bid.timestamp,
      amount: bid.amount,
      messageId: bid.messageId
    }));

    return NextResponse.json({
      liveChatId,
      messages: transformedMessages,
      bids: transformedBids,
      nextPageToken: chatData.nextPageToken,
      pollingInterval: chatData.pollingInterval,
    });

  } catch (error) {
    console.error(`❌ YouTube Chat API Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error while fetching chat messages' },
      { status: 500 }
    );
  }
}
