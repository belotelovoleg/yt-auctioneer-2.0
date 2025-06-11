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

// GET /api/youtube/cache - Get YouTube live chat ID cache statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cacheStats = YouTubeService.getCacheStats();
    
    return NextResponse.json({
      success: true,
      cache: {
        size: cacheStats.size,
        entries: cacheStats.entries.map(entry => ({
          videoId: entry.videoId,
          liveChatId: entry.liveChatId,
          ageSeconds: Math.round(entry.age / 1000),
          ttlSeconds: Math.round(entry.ttl / 1000),
          isExpired: entry.age > entry.ttl
        }))
      }
    });

  } catch (error) {
    console.error('❌ YouTube Cache API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching cache stats' },
      { status: 500 }
    );
  }
}

// DELETE /api/youtube/cache - Clear YouTube live chat ID cache
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (videoId) {
      YouTubeService.clearLiveChatIdCache(videoId);
      return NextResponse.json({
        success: true,
        message: `Cleared cache for video ${videoId}`
      });
    } else {
      YouTubeService.clearLiveChatIdCache();
      return NextResponse.json({
        success: true,
        message: 'Cleared entire YouTube live chat ID cache'
      });
    }

  } catch (error) {
    console.error('❌ YouTube Cache Clear API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while clearing cache' },
      { status: 500 }
    );
  }
}

