import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getEnvVar } from '@/lib/config-env';

const JWT_SECRET = new TextEncoder().encode(
  getEnvVar('JWT_SECRET')
);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; login: string };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// GET /api/lots - Get user's lots
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const whereClause: any = {
      userId: user.userId,
    };

    // Add status filter if provided
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }

    const lots = await prisma.lot.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Add calculatedPrice to each lot
    const lotsWithCalculatedPrice = lots.map(lot => ({
      ...lot,
      calculatedPrice: Math.max(0, Number(lot.startingPrice) - Number(lot.discount))
    }));

    return NextResponse.json(lotsWithCalculatedPrice);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lots' },
      { status: 500 }
    );
  }
}

// POST /api/lots - Create new lot
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const { 
      name, 
      description, 
      photo, 
      startingPrice, 
      priceStep, 
      timer, 
      discount
    } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }    const lot = await prisma.lot.create({
      data: {
        userId: user.userId,
        name,
        description: description || null,
        photo: photo || null,
        startingPrice: startingPrice || 100,
        priceStep: priceStep || 10,
        timer: timer || 120,
        discount: discount || 0,
      },
    });

    // Add calculatedPrice to response
    const lotWithCalculatedPrice = {
      ...lot,
      calculatedPrice: Math.max(0, Number(lot.startingPrice) - Number(lot.discount))
    };

    return NextResponse.json(lotWithCalculatedPrice, { status: 201 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create lot' },
      { status: 500 }
    );
  }
}

