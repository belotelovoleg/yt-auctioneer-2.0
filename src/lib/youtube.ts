// YouTube Data API v3 service
import { YOUTUBE_API_KEY } from './config-env';

interface LiveStreamDetails {
  activeLiveChatId?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

interface VideoResponse {
  items: Array<{
    id: string;
    liveStreamingDetails?: LiveStreamDetails;
  }>;
}

interface ChatMessage {
  id: string;
  snippet: {
    publishedAt: string;
    displayMessage: string;
    textMessageDetails: {
      messageText: string;
    };
  };
  authorDetails: {
    displayName: string;
    profileImageUrl: string;
  };
}

interface ChatResponse {
  items: ChatMessage[];
  nextPageToken?: string;
  pollingIntervalMillis?: number;
}

export class YouTubeService {
  private static readonly API_KEY = YOUTUBE_API_KEY;
  private static readonly BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private static readonly MIN_POLLING_INTERVAL = 10000; // 10 seconds minimum
  
  // Cache for live chat IDs to prevent unnecessary API calls
  private static liveChatIdCache = new Map<string, {
    liveChatId: string | null;
    timestamp: number;
    ttl: number; // Time-to-live in milliseconds
  }>();
  
  // Cache TTL: 30 minutes for successful lookups, 5 minutes for failures
  private static readonly CACHE_TTL_SUCCESS = 30 * 60 * 1000; // 30 minutes
  private static readonly CACHE_TTL_FAILURE = 5 * 60 * 1000;  // 5 minutes
  /**
   * Get live chat ID from a video ID (with caching to reduce quota usage)
   * @param videoId YouTube video ID
   * @returns Live chat ID if the video is a live stream, null otherwise
   */  static async getLiveChatId(videoId: string): Promise<string | null> {
    if (!this.API_KEY) {
      console.log('❌ YouTube Service: API key not configured');
      throw new Error('YouTube API key not configured');
    }

    // Check cache first
    const cached = this.liveChatIdCache.get(videoId);
    const now = Date.now();
      if (cached && now < cached.timestamp + cached.ttl) {
      console.log(`🎯 Getting live chat ID for video ${videoId} (from cache) - ${cached.liveChatId || 'null'}`);
      return cached.liveChatId;
    }

    // Remove expired cache entry
    if (cached) {
      this.liveChatIdCache.delete(videoId);
    }

    try {
      // Only request the specific field we need to reduce quota usage
      const url = `${this.BASE_URL}/videos?id=${videoId}&part=liveStreamingDetails&fields=items/liveStreamingDetails/activeLiveChatId&key=${this.API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data: VideoResponse = await response.json();
      
      if (data.items.length === 0) {
        // Cache the failure result to prevent repeated API calls
        this.liveChatIdCache.set(videoId, {
          liveChatId: null,
          timestamp: now,
          ttl: this.CACHE_TTL_FAILURE
        });
        console.log(`❌ Getting live chat ID for video ${videoId} (from URL) - video not found`);
        return null; // Video not found
      }

      const liveStreamingDetails = data.items[0].liveStreamingDetails;
      const liveChatId = liveStreamingDetails?.activeLiveChatId || null;
      
      if (!liveChatId) {
        // Cache the 'no live chat' result
        this.liveChatIdCache.set(videoId, {
          liveChatId: null,
          timestamp: now,
          ttl: this.CACHE_TTL_FAILURE
        });
        console.log(`❌ Getting live chat ID for video ${videoId} (from URL) - no active chat`);
        return null; // Not a live stream or no active chat
      }

      // Cache the successful result with longer TTL
      this.liveChatIdCache.set(videoId, {
        liveChatId,
        timestamp: now,
        ttl: this.CACHE_TTL_SUCCESS
      });
      console.log(`✅ Getting live chat ID for video ${videoId} (from URL) - ${liveChatId}`);
      
      return liveChatId;
    } catch (error) {
      console.error('❌ YouTube Service: Error getting live chat ID:', error);
      throw error;
    }
  }

  /**
   * Get live chat messages
   * @param liveChatId Live chat ID
   * @param pageToken Optional page token for pagination
   * @returns Chat messages and next page token
   */  static async getChatMessages(liveChatId: string, pageToken?: string): Promise<{
    messages: ChatMessage[];
    nextPageToken?: string;
    pollingInterval: number;
  }> {
    if (!this.API_KEY) {
      console.log('❌ YouTube Service: API key not configured for chat messages');
      throw new Error('YouTube API key not configured');
    }    try {
      // Only request the specific fields we actually use to minimize quota usage (removed channelId)
      let url = `${this.BASE_URL}/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&fields=items(id,snippet(publishedAt,textMessageDetails/messageText),authorDetails(displayName,profileImageUrl)),nextPageToken,pollingIntervalMillis&key=${this.API_KEY}`;
      
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data: ChatResponse = await response.json();
      
      // Use YouTube's recommended interval, but never go below 10 seconds (for rate limiting)
      const youtubeRecommended = data.pollingIntervalMillis || this.MIN_POLLING_INTERVAL;
      const pollingInterval = Math.max(youtubeRecommended, this.MIN_POLLING_INTERVAL);

      const bidsCount = this.extractBids(data.items).length;
      console.log(`⏰ ${new Date().toLocaleTimeString()}: Getting messages`);
      console.log(`📊 Got ${data.items.length} messages with ${bidsCount} bids in them`);
      console.log(`🔄 YT recommended polling interval - ${pollingInterval}ms (will do request in ${Math.round(pollingInterval / 1000)} seconds)`);

      return {
        messages: data.items,
        nextPageToken: data.nextPageToken,
        pollingInterval,
      };
    } catch (error) {
      console.error('❌ YouTube Service: Error getting chat messages:', error);
      throw error;
    }
  }

  /**
   * Get current live video ID from a channel ID
   * @param channelId YouTube channel ID  
   * @returns Live video ID if channel has an active live stream, null otherwise
   */
  static async getLiveVideoIdFromChannel(channelId: string): Promise<string | null> {
    if (!this.API_KEY) {
      console.log('❌ YouTube Service: API key not configured');
      throw new Error('YouTube API key not configured');
    }

    try {
      // Search for live videos from the specific channel
      const url = `${this.BASE_URL}/search?channelId=${channelId}&part=snippet&type=video&eventType=live&key=${this.API_KEY}`;
      console.log(`🔍 YouTube Service: Searching for live videos from channel ${channelId}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`❌ YouTube Service: Search API request failed with status ${response.status}`);
        const errorText = await response.text();
        console.log(`❌ YouTube Service: Error response: ${errorText}`);
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 YouTube Service: Found ${data.items.length} live videos from channel`);
      
      if (data.items.length === 0) {
        console.log(`ℹ️  YouTube Service: No live streams found for channel ${channelId}`);
        return null;
      }

      // Return the first live video ID
      const liveVideoId = data.items[0].id.videoId;
      console.log(`✅ YouTube Service: Found live video ID: ${liveVideoId}`);
      return liveVideoId;
      
    } catch (error) {
      console.error('❌ YouTube Service: Error getting live video from channel:', error);
      throw error;
    }
  }

  /**
   * Filter messages to extract numeric bids
   * @param messages Chat messages
   * @returns Array of bids with user info
   */  static extractBids(messages: ChatMessage[]): Array<{
    amount: number;
    user: {
      name: string;
      avatar: string;
    };
    timestamp: string;
    messageId: string;
  }> {    return messages
      .map(message => {        // Safely extract message text with null checking
        const textMessageDetails = message.snippet?.textMessageDetails;
        if (!textMessageDetails || !textMessageDetails.messageText) {
          // Skip messages without text content (system messages, etc.)
          return null;
        }
          const text = textMessageDetails.messageText.trim();
        
        // STRICT: Only accept messages that contain ONLY digits (no letters, spaces, or symbols)
        // This prevents "moon 653", "war 1942", "911 incident", etc. from being processed
        if (!/^\d+$/.test(text)) {
          return null;
        }
        
        const amount = parseInt(text, 10);
        
        // Check if the message is a valid positive number (bid)
        if (amount > 0) {
          return {
            amount,
            user: {
              name: message.authorDetails?.displayName || 'Unknown User',
              avatar: message.authorDetails?.profileImageUrl || '',
            },
            timestamp: message.snippet?.publishedAt || new Date().toISOString(),
            messageId: message.id,
          };
        }
          return null;
      })
      .filter(bid => bid !== null) as Array<{
        amount: number;        user: {
          name: string;
          avatar: string;
        };
        timestamp: string;
        messageId: string;
      }>;
  }

  /**
   * Clear cache for a specific video ID (useful when stream ends or errors occur)
   * @param videoId YouTube video ID to clear from cache
   */
  static clearLiveChatIdCache(videoId?: string): void {
    if (videoId) {
      this.liveChatIdCache.delete(videoId);
      console.log(`🗑️  YouTube Service: Cleared cache for video ${videoId}`);
    } else {
      this.liveChatIdCache.clear();
      console.log(`🗑️  YouTube Service: Cleared entire live chat ID cache`);
    }
  }

  /**
   * Get cache statistics for monitoring and debugging
   */
  static getCacheStats(): { size: number; entries: Array<{ videoId: string; liveChatId: string | null; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.liveChatIdCache.entries()).map(([videoId, data]) => ({
      videoId,
      liveChatId: data.liveChatId,
      age: now - data.timestamp,
      ttl: data.ttl
    }));
    
    return {
      size: this.liveChatIdCache.size,
      entries
    };
  }
}
