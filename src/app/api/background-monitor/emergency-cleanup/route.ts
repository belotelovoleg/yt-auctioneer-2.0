import { NextRequest, NextResponse } from 'next/server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';
import { validateToken } from '@/lib/auth-server';

// POST /api/background-monitor/emergency-cleanup - Emergency cleanup of ALL timers (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(`🚨 Emergency cleanup requested by admin ${user.login}`);
    
    // Get status before cleanup
    const statusBefore = await BackgroundAuctionMonitor.getMonitoringStatus();
    
    // Run emergency cleanup
    BackgroundAuctionMonitor.emergencyCleanup();
    
    // Get status after cleanup
    const statusAfter = await BackgroundAuctionMonitor.getMonitoringStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Emergency cleanup completed',
      before: {
        activeJobs: statusBefore.length,
        jobs: statusBefore
      },
      after: {
        activeJobs: statusAfter.length,
        jobs: statusAfter
      }
    });

  } catch (error) {
    console.error('Error during emergency cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
