import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';

// GET /api/background-monitor/logs - Get recent log entries (Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }const { searchParams } = new URL(request.url);
    const countParam = searchParams.get('count');
    const auctionIdParam = searchParams.get('auctionId');
    const lotIdParam = searchParams.get('lotId');
    const typeParam = searchParams.get('type') || 'global'; // 'global', 'job', or 'available'
    
    console.log('🔍 Logs API Debug:', {
      url: request.url,
      type: typeParam,
      auctionId: auctionIdParam,
      lotId: lotIdParam,
      count: countParam
    });
    
    const count = countParam ? parseInt(countParam, 10) : undefined;

    // Handle different request types
    if (typeParam === 'available') {
      // Return list of available log keys
      const keys = BackgroundAuctionMonitor.getAvailableLogKeys();
      return NextResponse.json({
        success: true,
        availableJobs: keys,
        totalJobs: keys.length
      });
    }

    if (typeParam === 'job' && auctionIdParam && lotIdParam) {
      // Return logs for specific job
      const auctionId = parseInt(auctionIdParam, 10);
      const lotId = parseInt(lotIdParam, 10);
      const logs = BackgroundAuctionMonitor.getJobLogs(auctionId, lotId, count);

      return NextResponse.json({
        success: true,
        logs,
        totalEntries: logs.length,
        maxEntries: 100,
        jobKey: `${auctionId}-${lotId}`,
        type: 'job'
      });
    }    // Default: return global logs
    const logs = BackgroundAuctionMonitor.getGlobalLogs(count);

    return NextResponse.json({
      success: true,
      logs,
      totalEntries: logs.length,
      maxEntries: 200,
      type: 'global'
    });

  } catch (error) {
    console.error('Error getting background monitor logs:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
