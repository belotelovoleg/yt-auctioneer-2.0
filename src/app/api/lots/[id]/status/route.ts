import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { BidProcessingService } from '@/lib/bidProcessing';
import { BackgroundAuctionMonitor } from '@/lib/backgroundMonitor';
import { JWT_SECRET } from '@/lib/config-env';

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_ENCODED);
    return payload as { userId: number; login: string };
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const lotId = parseInt(id);
    
    if (isNaN(lotId)) {
      return NextResponse.json({ error: 'Invalid lot ID' }, { status: 400 });
    }

    // Check if lot belongs to user
    const existingLot = await prisma.lot.findFirst({
      where: {
        id: lotId,
        userId: user.userId,
      },
    });

    if (!existingLot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }    const body = await request.json();
    const { status } = body;

    if (!status || !['READY', 'BEING_SOLD', 'SOLD', 'WITHDRAWN'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: READY, BEING_SOLD, SOLD, or WITHDRAWN' },
        { status: 400 }
      );
    }    // Prepare update data
    const updateData: any = { status };
    
    // Set sellingStartedAt when starting to sell
    if (status === 'BEING_SOLD') {
      // Check if any other lot is currently being sold
      const currentlySellingLot = await prisma.lot.findFirst({
        where: {
          status: 'BEING_SOLD',
          id: { not: lotId }, // Exclude current lot
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (currentlySellingLot) {
        return NextResponse.json(
          { 
            error: `Cannot start selling this lot. Another lot "${currentlySellingLot.name}" (ID: ${currentlySellingLot.id}) is currently being sold. Please finish selling the current lot first.` 
          },
          { status: 409 } // 409 Conflict
        );
      }

      updateData.sellingStartedAt = new Date();
    }
    // Clear sellingStartedAt when stopping selling
    else if (status === 'READY' || status === 'SOLD' || status === 'WITHDRAWN') {
      updateData.sellingStartedAt = null;
    }

    const success = await BidProcessingService.updateLotStatus(lotId, status, updateData);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update lot status' },
        { status: 500 }
      );
    }

    // Trigger background monitoring based on status change
    await BackgroundAuctionMonitor.handleLotStatusChange(lotId, status);

    return NextResponse.json({
      success: true,
      message: `Lot status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating lot status:', error);
    return NextResponse.json(
      { error: 'Failed to update lot status' },
      { status: 500 }
    );
  }
}
