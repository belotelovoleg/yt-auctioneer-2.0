import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/background-monitor/count - Get count of active monitoring jobs
export async function GET(request: NextRequest) {
  try {
    // Count active monitoring jobs
    const activeCount = await prisma.monitoringJob.count({
      where: { isActive: true }
    });
    
    // Get total count (including inactive)
    const totalCount = await prisma.monitoringJob.count();
    
    // Get active jobs grouped by auction
    const jobsByAuction = await prisma.monitoringJob.groupBy({
      by: ['auctionId'],
      where: { isActive: true },
      _count: {
        auctionId: true
      }
    });
    
    // Format auction groups for easier reading
    const auctionGroups = jobsByAuction.map(group => ({
      auctionId: group.auctionId,
      monitorCount: group._count.auctionId
    }));
      // Get lots with multiple active monitors
    const duplicateLots = await prisma.$queryRaw`
      SELECT lot_id as "lotId", COUNT(*) as "monitorCount"
      FROM monitoring_jobs
      WHERE is_active = true
      GROUP BY lot_id
      HAVING COUNT(*) > 1
    `;
    
    // Get detailed info about lots with duplicates
    let duplicateDetails = null;
    
    if (Array.isArray(duplicateLots) && duplicateLots.length > 0) {
      // Get additional details for duplicate lots
      const lotIds = (duplicateLots as any[]).map(d => d.lotId);
      
      duplicateDetails = await prisma.$queryRaw`
        SELECT 
          mj.lot_id as "lotId",
          mj.auction_id as "auctionId",
          mj.last_processed_time as "lastProcessedTime",
          mj.id as "monitorJobId",
          mj.created_at as "createdAt"
        FROM monitoring_jobs mj
        WHERE mj.is_active = true
        AND mj.lot_id IN (${lotIds.join(',')})
        ORDER BY mj.lot_id, mj.last_processed_time DESC
      `;
    }
    
    // Return counts with structured data
    return NextResponse.json({
      success: true,
      activeMonitors: activeCount,
      totalMonitors: totalCount,
      auctionGroups: auctionGroups,
      duplicateLots: Array.isArray(duplicateLots) && duplicateLots.length > 0 ? duplicateLots : null,
      duplicateDetails: duplicateDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting monitoring counts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
