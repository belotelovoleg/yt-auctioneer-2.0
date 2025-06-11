import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import * as XLSX from 'xlsx';
import { getEnvVar } from '@/lib/env-config';

const JWT_SECRET = new TextEncoder().encode(
  getEnvVar('JWT_SECRET')
);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number };
  } catch (error) {
    return null;
  }
}

// POST /api/auctions/[id]/export/excel - Export auction results to Excel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const auctionId = parseInt(id);
    
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: 'Invalid auction ID' }, { status: 400 });
    }

    const body = await request.json();
    const { buyerName } = body;

    // Get auction details
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        userId: user.userId,
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Get winning bids
    const whereClause: any = {
      auctionId: auctionId,
      isWinning: true,
      status: 'ACCEPTED',
      lot: {
        status: 'SOLD',
      },
    };

    if (buyerName) {
      whereClause.bidderName = buyerName;
    }

    const winningBids = await prisma.bid.findMany({
      where: whereClause,
      include: {
        lot: {
          select: {
            id: true,
            name: true,
            description: true,
            startingPrice: true,
            finalPrice: true,
          },
        },
      },
      orderBy: [
        { bidderName: 'asc' },
        { amount: 'desc' },
      ],
    });    // Prepare data for Excel
    const excelData = winningBids.map((bid, index) => ({
      'Item #': index + 1,
      'Bidder Name': bid.bidderName,
      'Lot Name': bid.lot.name,
      'Description': bid.lot.description || '',
      'Starting Price': Number(bid.lot.startingPrice),
      'Final Price': Number(bid.amount),
      'Source': bid.source,
      'Date': new Date(bid.createdAt).toLocaleDateString(),
      'Time': new Date(bid.createdAt).toLocaleTimeString(),
    }));

    // Add summary row
    const totalRevenue = winningBids.reduce((sum, bid) => sum + Number(bid.amount), 0);
    const totalStartingPrice = winningBids.reduce((sum, bid) => sum + Number(bid.lot.startingPrice), 0);
    
    excelData.push({
      'Item #': 0,
      'Bidder Name': '',
      'Lot Name': '',
      'Description': '',
      'Starting Price': 0,
      'Final Price': 0,
      'Source': 'ONLINE' as any,
      'Date': '',
      'Time': '',
    });

    excelData.push({
      'Item #': 0,
      'Bidder Name': 'TOTALS:',
      'Lot Name': `${winningBids.length} items`,
      'Description': '',
      'Starting Price': totalStartingPrice,
      'Final Price': totalRevenue,
      'Source': 'ONLINE' as any,
      'Date': '',
      'Time': '',
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 8 },  // Item #
      { wch: 20 }, // Bidder Name
      { wch: 25 }, // Lot Name
      { wch: 40 }, // Description
      { wch: 12 }, // Starting Price
      { wch: 12 }, // Final Price
      { wch: 10 }, // Source
      { wch: 12 }, // Date
      { wch: 12 }, // Time
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    const sheetName = buyerName ? `${buyerName} - Purchases` : 'All Results';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return Excel file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="auction-${auctionId}-results${buyerName ? `-${buyerName}` : ''}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('Error exporting Excel:', error);
    return NextResponse.json(
      { error: 'Failed to export Excel' },
      { status: 500 }
    );
  }
}
