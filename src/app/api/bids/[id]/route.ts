import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const bidId = parseInt(id);
    if (isNaN(bidId)) {
      return NextResponse.json(
        { error: "Invalid bid ID" },
        { status: 400 }
      );
    }

    // Check if bid exists
    const existingBid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        auction: true,
        lot: true
      }
    });

    if (!existingBid) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }    // Verify user owns the auction
    if (existingBid.auction.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only delete bids from your own auctions" },
        { status: 403 }
      );
    }

    // Delete the bid
    await prisma.bid.delete({
      where: { id: bidId }
    });    // Update winning status for remaining bids on this lot
    const remainingBids = await prisma.bid.findMany({
      where: {
        auctionId: existingBid.auctionId,
        lotId: existingBid.lotId,
        status: 'ACCEPTED'
      },
      orderBy: { amount: 'desc' }
    });

    // Update winning status
    await prisma.$transaction([
      // Reset all bids to non-winning
      prisma.bid.updateMany({
        where: {
          auctionId: existingBid.auctionId,
          lotId: existingBid.lotId,
          status: 'ACCEPTED'
        },
        data: { isWinning: false }
      }),
      // Set the highest remaining bid as winning (if any)
      ...(remainingBids.length > 0 ? [
        prisma.bid.update({
          where: { id: remainingBids[0].id },
          data: { isWinning: true }
        })
      ] : [])
    ]);

    console.log(`✅ Bid ${bidId} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: "Bid deleted successfully",
      remainingBidsCount: remainingBids.length
    });

  } catch (error) {
    console.error("Error deleting bid:", error);
    return NextResponse.json(
      { error: "Failed to delete bid" },
      { status: 500 }
    );
  }
}
