import { NextRequest, NextResponse } from 'next/server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';
import { validateToken } from '@/lib/auth-server';

// GET /api/background-monitor/status - Get current monitoring status (Admin only)
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const status = await BackgroundAuctionMonitor.getMonitoringStatus();
    
    return NextResponse.json({
      success: true,
      activeJobs: status.length,
      jobs: status
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/background-monitor/cleanup - Clean up orphaned monitoring jobs (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(`🧹 Admin ${user.login} starting cleanup of orphaned monitoring jobs...`);
    
    // Stop all current monitoring jobs
    BackgroundAuctionMonitor.stopAll();
    
    // Re-initialize with only valid lots
    await BackgroundAuctionMonitor.initialize();
    
    const newStatus = await BackgroundAuctionMonitor.getMonitoringStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      activeJobsAfterCleanup: newStatus.length,
      jobs: newStatus
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
