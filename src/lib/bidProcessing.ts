import { PrismaClient } from '../generated/prisma';
import { BidValidationService } from './bidValidation';

const prisma = new PrismaClient();

interface YouTubeChatBid {
  authorName: string;
  authorPhotoUrl?: string;
  timestamp: string;
  amount: number;
  messageId?: string;
}

export class BidProcessingService {
  private static processingQueues = new Map<string, boolean>();

  /**
   * Process bids from YouTube chat for a specific auction/lot
   */
  static async processYouTubeBids(
    auctionId: number,
    lotId: number,
    chatBids: YouTubeChatBid[]
  ): Promise<{
    processed: number;
    created: number;
    errors: string[];
    currentWinningBid?: any;
  }> {
    const queueKey = `${auctionId}-${lotId}`;
    
    // Prevent concurrent processing for the same lot
    if (this.processingQueues.get(queueKey)) {
      return {
        processed: 0,
        created: 0,
        errors: ['Processing already in progress for this lot']
      };
    }    this.processingQueues.set(queueKey, true);

    try {      // Get lot's selling start time to filter old messages
      const lot = await prisma.lot.findUnique({
        where: { id: lotId },
        select: { sellingStartedAt: true, status: true }
      });

      if (!lot || lot.status !== 'BEING_SOLD' || !lot.sellingStartedAt) {
        console.log(`⏸️ Lot ${lotId} is not actively being sold or missing sellingStartedAt`);
        return {
          processed: 0,
          created: 0,
          errors: ['Lot is not actively being sold']
        };
      }

      const sellingStartTime = new Date(lot.sellingStartedAt);
      console.log(`🕐 Filtering bids after selling start time: ${sellingStartTime.toISOString()}`);

      // Filter out messages that are older than when selling started
      const recentBids = chatBids.filter(bid => {
        const bidTime = new Date(bid.timestamp);
        const isRecent = bidTime >= sellingStartTime;
        if (!isRecent) {
          console.log(`⏰ Filtered out old bid from ${bid.authorName} (${bid.amount}) - bid time: ${bidTime.toISOString()}, selling started: ${sellingStartTime.toISOString()}`);
        }
        return isRecent;
      });

      console.log(`📊 Filtered ${chatBids.length} messages → ${recentBids.length} recent bids`);

      // Filter out already processed bids
      const newBids: YouTubeChatBid[] = [];
        for (const bid of recentBids) {
        if (bid.messageId) {
          const existing = await prisma.bid.findFirst({
            where: { messageId: bid.messageId }
          });
          
          if (!existing) {
            newBids.push(bid);
          }
        } else {
          // If no messageId, always process (manual bids)
          newBids.push(bid);
        }
      }

      if (newBids.length === 0) {
        return {
          processed: 0,
          created: 0,
          errors: []
        };
      }

      // Sort bids by timestamp and amount to process highest bids first
      const sortedBids = newBids.sort((a, b) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.amount - a.amount; // Higher amounts first for same timestamp
      });

      const errors: string[] = [];
      let processed = 0;
      let created = 0;
      let currentWinningBid = null;

      // Process each bid in a transaction
      for (const chatBid of sortedBids) {
        processed++;

        try {
          const result = await prisma.$transaction(async (tx) => {
            // Validate the bid
            const validation = await BidValidationService.validateBid({
              auctionId,
              lotId,
              amount: chatBid.amount,
              bidderName: chatBid.authorName,
              source: 'YOUTUBE',
              messageId: chatBid.messageId
            });            if (!validation.isValid) {
              errors.push(`${chatBid.authorName} (${chatBid.amount}): ${validation.error}`);
              return null;
            }            // Use adjusted amount if validation provided one (for rounding down to valid increments)
            const finalBidAmount = validation.adjustedAmount || chatBid.amount;

            // Check if a higher bid was already processed
            const existingHigherBid = await tx.bid.findFirst({
              where: {
                auctionId,
                lotId,
                amount: { gte: finalBidAmount },
                status: 'ACCEPTED'
              }
            });

            if (existingHigherBid) {
              errors.push(`${chatBid.authorName} (${chatBid.amount}): Outbid by higher bid`);
              return null;
            }// Mark previous winning bids as outbid
            await tx.bid.updateMany({
              where: {
                auctionId,
                lotId,
                isWinning: true
              },
              data: {
                isWinning: false,
                status: 'OUTBID'
              }
            });            // Create the new bid
            const newBid = await tx.bid.create({
              data: {
                auctionId,
                lotId,
                bidderName: chatBid.authorName,
                amount: finalBidAmount, // Use the adjusted amount
                source: 'YOUTUBE',
                status: 'ACCEPTED',
                isWinning: true,
                messageId: chatBid.messageId,
                metadata: {
                  authorPhotoUrl: chatBid.authorPhotoUrl,
                  timestamp: chatBid.timestamp,
                  originalAmount: chatBid.amount // Keep track of original bid for reference
                }
              }
            });

            return newBid;
          });

          if (result) {
            created++;
            currentWinningBid = result;
          }

        } catch (error) {
          console.error(`Error processing bid from ${chatBid.authorName}:`, error);
          errors.push(`${chatBid.authorName}: Processing error`);
        }
      }

      return {
        processed,
        created,
        errors,
        currentWinningBid
      };

    } finally {
      this.processingQueues.delete(queueKey);
    }
  }

  /**
   * Create a manual bid (from auctioneer interface)
   */
  static async createManualBid(
    auctionId: number,
    lotId: number,
    bidderName: string,
    amount: number,
    bidderEmail?: string
  ): Promise<{
    success: boolean;
    bid?: any;
    error?: string;
  }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Validate the bid
        const validation = await BidValidationService.validateBid({
          auctionId,
          lotId,
          amount,
          bidderName,
          source: 'MANUAL'
        });

        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid bid');
        }        // Mark previous winning bids as outbid
        await (tx as any).bid.updateMany({
          where: {
            auctionId,
            lotId,
            isWinning: true
          },
          data: {
            isWinning: false,
            status: 'OUTBID'
          }
        });        // Create the new bid
        const newBid = await (tx as any).bid.create({
          data: {
            auctionId,
            lotId,
            bidderName,
            bidderEmail,
            amount,
            source: 'MANUAL',
            status: 'ACCEPTED',
            isWinning: true
          }
        });

        return newBid;
      });

      return {
        success: true,
        bid: result
      };

    } catch (error) {
      console.error('Error creating manual bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bid'
      };
    }
  }

  /**
   * Get all bids for a lot (for display in UI)
   */
  static async getBidsForLot(
    auctionId: number,
    lotId: number,
    limit: number = 10  ): Promise<any[]> {
    try {
      return await (prisma as any).bid.findMany({
        where: {
          auctionId,
          lotId
        },
        orderBy: [
          { amount: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              login: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching bids for lot:', error);
      return [];
    }
  }
  /**
   * Update lot status when selling starts/stops
   */
  static async updateLotStatus(
    lotId: number,
    status: 'READY' | 'BEING_SOLD' | 'SOLD' | 'WITHDRAWN',
    additionalData?: any
  ): Promise<boolean> {
    try {
      const updateData = { status, ...additionalData };
      await (prisma as any).lot.update({
        where: { id: lotId },
        data: updateData
      });
      return true;
    } catch (error) {
      console.error('Error updating lot status:', error);
      return false;
    }
  }

  /**
   * Get bid statistics for a lot
   */
  static async getLotBidStats(auctionId: number, lotId: number): Promise<{
    totalBids: number;
    uniqueBidders: number;
    currentPrice: number;
    startingPrice: number;
  }> {    try {
      const [bidsCount, uniqueBidders, winningBid, lot] = await Promise.all([
        (prisma as any).bid.count({
          where: { auctionId, lotId }
        }),
        (prisma as any).bid.groupBy({
          by: ['bidderName'],
          where: { auctionId, lotId }
        }),
        (prisma as any).bid.findFirst({
          where: { 
            auctionId, 
            lotId, 
            isWinning: true,
            status: 'ACCEPTED'
          },
          orderBy: { amount: 'desc' }
        }),
        prisma.lot.findUnique({
          where: { id: lotId },
          select: { startingPrice: true }
        })
      ]);

      return {
        totalBids: bidsCount,
        uniqueBidders: uniqueBidders.length,
        currentPrice: winningBid ? parseFloat(winningBid.amount.toString()) : 0,
        startingPrice: lot ? parseFloat(lot.startingPrice.toString()) : 0
      };

    } catch (error) {
      console.error('Error getting lot bid stats:', error);
      return {
        totalBids: 0,
        uniqueBidders: 0,
        currentPrice: 0,
        startingPrice: 0
      };
    }
  }
}
