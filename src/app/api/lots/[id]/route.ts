import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/config-env';

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_ENCODED);
    return payload as { userId: number; login: string };
  } catch {
    return null;
  }
}

// PUT /api/lots/[id] - Update lot
export async function PUT(
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
    }    const { 
      name, 
      description, 
      photo, 
      startingPrice, 
      priceStep, 
      timer, 
      discount,
      useTimer
    } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }    const lot = await prisma.lot.update({
      where: { id: lotId },
      data: {
        name,
        description: description || null,
        photo: photo || null,
        startingPrice: startingPrice || 100,
        priceStep: priceStep || 10,
        timer: timer || 120,
        discount: discount || 0,
        useTimer: useTimer !== undefined ? useTimer : existingLot.useTimer,
      },
    });

    // Add calculatedPrice to response
    const lotWithCalculatedPrice = {
      ...lot,
      calculatedPrice: Math.max(0, Number(lot.startingPrice) - Number(lot.discount))
    };

    return NextResponse.json(lotWithCalculatedPrice);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update lot' },
      { status: 500 }
    );
  }
}

// PATCH /api/lots/[id] - Partially update lot (e.g., discount)
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
    const { discount, useTimer, startingPrice, finalPrice, status } = body;

    // Validate discount value - accept both numbers and numeric strings
    if (discount !== undefined) {
      const discountNum = typeof discount === 'string' ? parseFloat(discount) : discount;
      if (typeof discountNum !== 'number' || isNaN(discountNum) || discountNum < 0) {
        return NextResponse.json({ error: 'Invalid discount value' }, { status: 400 });
      }
    }

    // Validate useTimer value
    if (useTimer !== undefined && typeof useTimer !== 'boolean') {
      return NextResponse.json({ error: 'Invalid useTimer value' }, { status: 400 });
    }

    // Validate startingPrice value - accept both numbers and numeric strings
    if (startingPrice !== undefined) {
      const priceNum = typeof startingPrice === 'string' ? parseFloat(startingPrice) : startingPrice;
      if (typeof priceNum !== 'number' || isNaN(priceNum) || priceNum <= 0) {
        return NextResponse.json({ error: 'Invalid startingPrice value' }, { status: 400 });
      }
    }

    // Validate finalPrice value - accept both numbers and numeric strings
    if (finalPrice !== undefined) {
      const priceNum = typeof finalPrice === 'string' ? parseFloat(finalPrice) : finalPrice;
      if (typeof priceNum !== 'number' || isNaN(priceNum) || priceNum <= 0) {
        return NextResponse.json({ error: 'Invalid finalPrice value' }, { status: 400 });
      }
    }

    // Validate status value
    if (status !== undefined && !['READY', 'BEING_SOLD', 'SOLD', 'WITHDRAWN'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be: READY, BEING_SOLD, SOLD, or WITHDRAWN' }, { status: 400 });
    }

    // Update lot - ensure numeric values are properly converted
    const updateData: any = {};
    if (discount !== undefined) {
      updateData.discount = typeof discount === 'string' ? parseFloat(discount) : discount;
    }
    if (useTimer !== undefined) {
      updateData.useTimer = useTimer;
    }
    if (startingPrice !== undefined) {
      updateData.startingPrice = typeof startingPrice === 'string' ? parseFloat(startingPrice) : startingPrice;
    }
    if (finalPrice !== undefined) {
      updateData.finalPrice = typeof finalPrice === 'string' ? parseFloat(finalPrice) : finalPrice;
    }
    if (status !== undefined) {
      updateData.status = status;
    }const updatedLot = await prisma.lot.update({
      where: { id: lotId },
      data: updateData,
    });

    // Add calculatedPrice to response
    const lotWithCalculatedPrice = {
      ...updatedLot,
      calculatedPrice: Math.max(0, Number(updatedLot.startingPrice) - Number(updatedLot.discount))
    };

    return NextResponse.json(lotWithCalculatedPrice);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update lot' },
      { status: 500 }
    );
  }
}

// DELETE /api/lots/[id] - Delete lot
export async function DELETE(
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
    }

    await prisma.lot.delete({
      where: { id: lotId },
    });

    return NextResponse.json({ message: 'Lot deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to delete lot' },
      { status: 500 }
    );
  }
}
