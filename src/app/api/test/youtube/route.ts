import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/youtube';
import { getEnvVar } from '@/lib/env-config';

// GET /api/test/youtube?videoId=xxx - Test YouTube API with detailed logging
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId') || 'jfKfPfyJRdk';

    console.log(`🧪 YouTube Test: Starting test for video ${videoId}`);

    // Step 1: Test basic video info
    console.log('🔍 Step 1: Testing basic video info...');
    const videoInfoUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,liveStreamingDetails&key=${getEnvVar('YOUTUBE_API_KEY')}`;
    const videoResponse = await fetch(videoInfoUrl);
    const videoData = await videoResponse.json();
    
    console.log('📊 Video API Response:', JSON.stringify(videoData, null, 2));

    if (!videoResponse.ok) {
      console.log('❌ Video API request failed');
      return NextResponse.json({ error: 'Video API request failed', details: videoData }, { status: 500 });
    }

    if (videoData.items.length === 0) {
      console.log('❌ Video not found');
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = videoData.items[0];
    console.log(`✅ Video found: ${video.snippet.title}`);
    console.log(`📹 Channel: ${video.snippet.channelTitle}`);
    console.log(`📅 Published: ${video.snippet.publishedAt}`);

    // Step 2: Check live streaming details
    console.log('🔍 Step 2: Checking live streaming details...');
    const liveDetails = video.liveStreamingDetails;
    
    if (!liveDetails) {
      console.log('ℹ️  This video has no live streaming details (not a live stream)');
      return NextResponse.json({
        success: true,
        videoId,
        title: video.snippet.title,
        isLiveStream: false,
        message: 'This video is not a live stream'
      });
    }

    console.log('📊 Live streaming details:', JSON.stringify(liveDetails, null, 2));

    // Step 3: Try to get live chat ID
    console.log('🔍 Step 3: Getting live chat ID...');
    try {
      const liveChatId = await YouTubeService.getLiveChatId(videoId);
      
      if (!liveChatId) {
        console.log('ℹ️  No active live chat found');
        return NextResponse.json({
          success: true,
          videoId,
          title: video.snippet.title,
          isLiveStream: true,
          hasActiveLiveChat: false,
          liveStreamingDetails: liveDetails,
          message: 'Live stream found but no active chat'
        });
      }

      console.log(`✅ Live chat ID found: ${liveChatId}`);

      // Step 4: Try to get chat messages
      console.log('🔍 Step 4: Fetching chat messages...');
      const chatData = await YouTubeService.getChatMessages(liveChatId);
      const bids = YouTubeService.extractBids(chatData.messages);

      console.log(`✅ Test completed successfully!`);
      console.log(`📊 Results: ${chatData.messages.length} messages, ${bids.length} bids`);

      return NextResponse.json({
        success: true,
        videoId,
        title: video.snippet.title,
        isLiveStream: true,
        hasActiveLiveChat: true,
        liveChatId,
        messageCount: chatData.messages.length,
        bidCount: bids.length,
        liveStreamingDetails: liveDetails,
        sampleMessages: chatData.messages.slice(0, 5).map(msg => ({
          author: msg.authorDetails.displayName,
          message: msg.snippet.textMessageDetails.messageText,
          timestamp: msg.snippet.publishedAt
        })),
        bids: bids.slice(0, 10)
      });

    } catch (chatError) {
      console.error('❌ Error in chat operations:', chatError);
      return NextResponse.json({
        success: false,
        videoId,
        title: video.snippet.title,
        isLiveStream: true,
        error: 'Failed to access live chat',
        details: chatError instanceof Error ? chatError.message : 'Unknown error',
        liveStreamingDetails: liveDetails
      });
    }

  } catch (error) {
    console.error('❌ YouTube Test Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
