import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { JWT_SECRET } from '@/lib/config-env';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_ENCODED);
    return payload as { userId: number };
  } catch (error) {
    return null;
  }
}

// POST /api/auctions/[id]/export/pdf - Export auction results to PDF
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
    });

    // Create PDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(`Auction Results: ${auction.name}`, 20, 30);
    
    if (buyerName) {
      doc.setFontSize(16);
      doc.text(`Buyer: ${buyerName}`, 20, 45);
    }

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, buyerName ? 60 : 45);

    // Prepare table data
    const tableData = winningBids.map((bid, index) => [
      index + 1,
      bid.bidderName,
      bid.lot.name,
      Number(bid.lot.startingPrice).toFixed(0),
      Number(bid.amount).toFixed(0),
      bid.source,
      new Date(bid.createdAt).toLocaleDateString(),
    ]);

    // Calculate totals
    const totalRevenue = winningBids.reduce((sum, bid) => sum + Number(bid.amount), 0);
    const totalStartingPrice = winningBids.reduce((sum, bid) => sum + Number(bid.lot.startingPrice), 0);

    // Add table
    doc.autoTable({
      startY: buyerName ? 70 : 55,
      head: [['#', 'Bidder', 'Lot Name', 'Starting Price', 'Final Price', 'Source', 'Date']],
      body: tableData,
      foot: [['', 'TOTAL:', `${winningBids.length} items`, totalStartingPrice.toFixed(0), totalRevenue.toFixed(0), '', '']],
      theme: 'striped',
      headStyles: { fillColor: [22, 160, 133] },
      footStyles: { fillColor: [52, 152, 219], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 15 },  // #
        1: { cellWidth: 30 },  // Bidder
        2: { cellWidth: 50 },  // Lot Name
        3: { cellWidth: 25 },  // Starting Price
        4: { cellWidth: 25 },  // Final Price
        5: { cellWidth: 20 },  // Source
        6: { cellWidth: 25 },  // Date
      },
    });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="auction-${auctionId}-results${buyerName ? `-${buyerName}` : ''}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error exporting PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export PDF' },
      { status: 500 }
    );
  }
}
