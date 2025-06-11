import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-server';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';
import { initializeBackgroundServices, isBackgroundServicesInitialized } from '@/lib/backgroundServices';

// GET /api/background-monitor - Get monitoring status (Admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Ensure background services are initialized
    if (!isBackgroundServicesInitialized()) {
      await initializeBackgroundServices();
    }

    const monitoringStatus = await BackgroundAuctionMonitor.getMonitoringStatus();

    return NextResponse.json({
      isInitialized: isBackgroundServicesInitialized(),
      activeMonitors: monitoringStatus.length,
      monitors: monitoringStatus
    });

  } catch (error) {
    console.error('Error getting background monitor status:', error);
    return NextResponse.json(
      { error: 'Failed to get monitoring status' },
      { status: 500 }
    );
  }
}

// POST /api/background-monitor - Start/stop monitoring manually
export async function POST(request: NextRequest) {
  try {
    const user = await validateToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, auctionId, lotId } = body;

    // Ensure background services are initialized
    if (!isBackgroundServicesInitialized()) {
      await initializeBackgroundServices();
    }

    if (action === 'start') {
      if (!auctionId || !lotId) {
        return NextResponse.json(
          { error: 'auctionId and lotId are required for start action' },
          { status: 400 }
        );
      }

      const success = await BackgroundAuctionMonitor.startMonitoring(
        parseInt(auctionId),
        parseInt(lotId)
      );

      return NextResponse.json({
        success,
        message: success 
          ? `Started monitoring auction ${auctionId}, lot ${lotId}`
          : `Failed to start monitoring auction ${auctionId}, lot ${lotId}`
      });

    } else if (action === 'stop') {
      if (!auctionId || !lotId) {
        return NextResponse.json(
          { error: 'auctionId and lotId are required for stop action' },
          { status: 400 }
        );
      }      const success = await BackgroundAuctionMonitor.stopMonitoring(
        parseInt(auctionId),
        parseInt(lotId)
      );

      return NextResponse.json({
        success,
        message: success 
          ? `Stopped monitoring auction ${auctionId}, lot ${lotId}`
          : `Was not monitoring auction ${auctionId}, lot ${lotId}`
      });    } else if (action === 'stopAll') {
      BackgroundAuctionMonitor.stopAll();
      
      return NextResponse.json({
        success: true,
        message: 'Stopped all monitoring'
      });    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start", "stop", "stopAll", or "emergencyCleanup"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error controlling background monitor:', error);
    return NextResponse.json(
      { error: 'Failed to control monitoring' },
      { status: 500 }
    );
  }
}

// DELETE /api/background-monitor - Emergency cleanup (no auth required for critical system maintenance)
export async function DELETE(request: NextRequest) {
  try {
    console.log('🚨 Emergency cleanup requested - clearing all orphaned timers');
    
    BackgroundAuctionMonitor.emergencyCleanup();
    
    return NextResponse.json({
      success: true,
      message: 'Emergency cleanup completed - all timers cleared',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during emergency cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to perform emergency cleanup' },
      { status: 500 }
    );
  }
}
