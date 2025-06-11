import { PrismaClient, Bid, Lot } from '../generated/prisma';
import { prisma } from './db';

// Remove the local prisma instance - use the shared one from db.ts

interface BidValidationResult {
  isValid: boolean;
  error?: string;
  currentPrice?: number;
  minBidAmount?: number;
  bidStep?: number;
  adjustedAmount?: number; // The amount after rounding down to valid increment
}

interface BidData {
  auctionId: number;
  lotId: number;
  amount: number;
  bidderName: string;
  source?: string;
  messageId?: string;
}

export class BidValidationService {
  /**
   * Validate a bid according to auction rules
   */
  static async validateBid(bidData: BidData): Promise<BidValidationResult> {
    try {
      const { auctionId, lotId, amount, bidderName } = bidData;

      // Basic validation
      if (!auctionId || !lotId || !amount || !bidderName) {
        return {
          isValid: false,
          error: 'Missing required bid information'
        };
      }

      if (amount <= 0) {
        return {
          isValid: false,
          error: 'Bid amount must be positive'
        };
      }

      // Get lot information
      const lot = await prisma.lot.findUnique({
        where: { id: lotId }
      });

      if (!lot) {
        return {
          isValid: false,
          error: 'Lot not found'
        };
      }

      // Check lot status
      if (lot.status !== 'BEING_SOLD') {
        return {
          isValid: false,
          error: 'Lot is not currently being sold'
        };
      }      // Get current highest bid
      const currentHighestBid = await prisma.bid.findFirst({
        where: {
          auctionId,
          lotId,
          status: 'ACCEPTED'
        },
        orderBy: { amount: 'desc' }
      });

      // Calculate calculated price (starting price - discount)
      const startingPrice = parseFloat(lot.startingPrice.toString());
      const discount = parseFloat(lot.discount?.toString() || '0');
      const calculatedPrice = startingPrice - discount;

      // Calculate minimum bid requirements
      const currentPrice = currentHighestBid ? 
        parseFloat(currentHighestBid.amount.toString()) : 
        calculatedPrice;
      
      const priceStep = parseFloat(lot.priceStep.toString());
      
      // For first bid, minimum is calculated price; for subsequent bids, it's current + step
      const minBidAmount = currentHighestBid ? 
        currentPrice + priceStep : 
        calculatedPrice;      // Validate bid amount meets minimum
      if (amount < minBidAmount) {
        return {
          isValid: false,
          error: `Bid too low. Minimum bid: ${minBidAmount}`,
          currentPrice,
          minBidAmount,
          bidStep: priceStep
        };
      }

      // PROTECTION: Maximum bid limit (current highest bid × 100)
      // This prevents unreasonably high bids like 100,000,000 on a 100 starting price lot
      const maxAllowedBid = currentPrice * 100;
      if (amount > maxAllowedBid) {
        return {
          isValid: false,
          error: `Bid too high. Maximum allowed: ${maxAllowedBid} (current price × 100)`,
          currentPrice,
          minBidAmount,
          bidStep: priceStep
        };
      }

      // Instead of rejecting non-increment bids, round DOWN to nearest valid increment
      // For example: bid 707 with step 50 becomes 700
      const bidOverMinimum = amount - calculatedPrice;
      const adjustedBidOverMinimum = Math.floor(bidOverMinimum / priceStep) * priceStep;
      const adjustedAmount = calculatedPrice + adjustedBidOverMinimum;
      
      // Make sure the adjusted amount still meets minimum requirements
      if (adjustedAmount < minBidAmount) {
        return {
          isValid: false,
          error: `Bid too low. Minimum bid: ${minBidAmount}`,
          currentPrice,
          minBidAmount,
          bidStep: priceStep
        };
      }

      // Also check that adjusted amount doesn't exceed maximum
      if (adjustedAmount > maxAllowedBid) {
        return {
          isValid: false,
          error: `Bid too high. Maximum allowed: ${maxAllowedBid} (current price × 100)`,
          currentPrice,
          minBidAmount,
          bidStep: priceStep
        };
      }

      // Check for duplicate YouTube bids
      if (bidData.source === 'YOUTUBE' && bidData.messageId) {
        const existingBid = await prisma.bid.findFirst({
          where: { messageId: bidData.messageId }
        });

        if (existingBid) {
          return {
            isValid: false,
            error: 'Bid already processed'
          };
        }
      }      return {
        isValid: true,
        currentPrice,
        minBidAmount,
        bidStep: priceStep,
        adjustedAmount: adjustedAmount
      };    } catch (error) {
      console.error('Error validating bid:', error);
      console.error('Bid data that caused error:', bidData);
      return {
        isValid: false,
        error: `Failed to validate bid: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Process multiple bids from YouTube chat and create valid ones
   */
  static async processChatBids(
    auctionId: number, 
    lotId: number, 
    chatBids: Array<{
      authorName: string;
      authorPhotoUrl?: string;
      timestamp: string;
      amount: number;
      messageId?: string;
    }>
  ): Promise<{
    processed: number;
    created: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;
    let created = 0;

    // Sort bids by timestamp to process in order
    const sortedBids = chatBids.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const chatBid of sortedBids) {
      processed++;

      try {
        // Validate the bid
        const validation = await this.validateBid({
          auctionId,
          lotId,
          amount: chatBid.amount,
          bidderName: chatBid.authorName,
          source: 'YOUTUBE',
          messageId: chatBid.messageId
        });

        if (!validation.isValid) {
          errors.push(`${chatBid.authorName}: ${validation.error}`);
          continue;
        }

        // Create the bid
        await prisma.bid.create({
          data: {
            auctionId,
            lotId,
            bidderName: chatBid.authorName,
            amount: chatBid.amount,
            source: 'YOUTUBE',
            status: 'ACCEPTED',
            isWinning: true,
            messageId: chatBid.messageId,
            metadata: {
              authorPhotoUrl: chatBid.authorPhotoUrl,
              timestamp: chatBid.timestamp
            }
          }
        });

        created++;

        // Mark previous bids as outbid
        await prisma.bid.updateMany({
          where: {
            auctionId,
            lotId,
            isWinning: true,
            id: { not: undefined } // This will be updated after creation
          },
          data: {
            isWinning: false,
            status: 'OUTBID'
          }
        });

      } catch (error) {
        console.error(`Error processing bid from ${chatBid.authorName}:`, error);
        errors.push(`${chatBid.authorName}: Processing error`);
      }
    }

    return { processed, created, errors };
  }

  /**
   * Get current winning bid for a lot
   */
  static async getCurrentWinningBid(auctionId: number, lotId: number): Promise<Bid | null> {
    try {
      return await prisma.bid.findFirst({
        where: {
          auctionId,
          lotId,
          isWinning: true,
          status: 'ACCEPTED'
        },
        orderBy: { amount: 'desc' }
      });
    } catch (error) {
      console.error('Error getting current winning bid:', error);
      return null;
    }
  }

  /**
   * Finalize lot sale with winning bid
   */
  static async finalizeLotSale(auctionId: number, lotId: number): Promise<{
    success: boolean;
    winningBid?: Bid;
    error?: string;
  }> {
    try {
      const winningBid = await this.getCurrentWinningBid(auctionId, lotId);
      
      if (!winningBid) {
        return {
          success: false,
          error: 'No winning bid found'
        };
      }

      // Update lot status and final price
      await prisma.lot.update({
        where: { id: lotId },
        data: {
          status: 'SOLD',
          finalPrice: winningBid.amount
        }
      });

      return {
        success: true,
        winningBid
      };

    } catch (error) {
      console.error('Error finalizing lot sale:', error);
      return {
        success: false,
        error: 'Failed to finalize sale'
      };
    }
  }
}
