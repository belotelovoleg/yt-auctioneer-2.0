import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';

// GET /api/background-monitor/debug - Debug endpoint to inspect monitor state (Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'test-log') {
      // Add a test log entry
      BackgroundAuctionMonitor.addTestLog();
      
      // Get current state
      const globalLogs = BackgroundAuctionMonitor.getGlobalLogs();
      const jobLogs = BackgroundAuctionMonitor.getJobLogs(1, 1);
      const availableKeys = BackgroundAuctionMonitor.getAvailableLogKeys();

      return NextResponse.json({
        success: true,
        action: 'test-log-added',
        globalLogsCount: globalLogs.length,
        jobLogsCount: jobLogs.length,
        availableKeys,
        lastGlobalLog: globalLogs[0] || null,
        lastJobLog: jobLogs[0] || null
      });
    }

    // Default: return current state
    const globalLogs = BackgroundAuctionMonitor.getGlobalLogs();
    const jobLogs = BackgroundAuctionMonitor.getJobLogs(1, 1);
    const availableKeys = BackgroundAuctionMonitor.getAvailableLogKeys();

    return NextResponse.json({
      success: true,
      debug: {
        globalLogsCount: globalLogs.length,
        jobLogsCount: jobLogs.length,
        availableKeys,
        hasGlobalLogs: globalLogs.length > 0,
        hasJobLogs: jobLogs.length > 0,
        lastGlobalLog: globalLogs[0] || null,
        lastJobLog: jobLogs[0] || null
      }
    });
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
