import { NextRequest, NextResponse } from 'next/server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';
import { isBackgroundServicesInitialized } from '@/lib/backgroundServices';

// GET /api/background-monitor/status - Get current monitoring status
export async function GET(request: NextRequest) {
  try {
    const status = await BackgroundAuctionMonitor.getMonitoringStatus();
    
    // Get initialization and environment status
    const initStatus = {
      backgroundServicesInitialized: isBackgroundServicesInitialized(),
      monitorInitialized: (BackgroundAuctionMonitor as any).isInitialized === true,
      isServerless: (BackgroundAuctionMonitor as any).IS_SERVERLESS === true,
      environment: process.env.NODE_ENV || 'unknown',
    };
    
    const result = {
      success: true,
      activeJobs: status.length,
      jobs: status,
      initialization: initStatus,
      summary: {
        totalJobs: status.length,
        jobsByAuction: status.reduce((acc: Record<number, number>, job) => {
          acc[job.auctionId] = (acc[job.auctionId] || 0) + 1;
          return acc;
        }, {}),
        oldestJob: status.length > 0 ? Math.min(...status.map(job => 
          new Date().getTime() - new Date(job.lastProcessedTime).getTime()
        )) : 0
      },
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ STATUS API: Error getting monitoring status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/background-monitor/status - Stop all monitoring jobs (cleanup)
export async function DELETE(request: NextRequest) {
  try {
    const status = await BackgroundAuctionMonitor.getMonitoringStatus();
    const jobCount = status.length;
    
    BackgroundAuctionMonitor.stopAll();
    
    return NextResponse.json({
      success: true,
      message: `Stopped ${jobCount} monitoring jobs`,
      stoppedJobs: jobCount
    });

  } catch (error) {
    console.error('Error stopping monitoring jobs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
