-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('READY', 'BEING_SOLD', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BidSource" AS ENUM ('MANUAL', 'YOUTUBE', 'PHONE', 'ONLINE');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'OUTBID', 'REJECTED');

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "finalPrice" DECIMAL(10,2),
ADD COLUMN     "status" "LotStatus" NOT NULL DEFAULT 'READY';

-- CreateTable
CREATE TABLE "bids" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "userId" INTEGER,
    "bidderName" TEXT NOT NULL,
    "bidderEmail" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" "BidSource" NOT NULL DEFAULT 'MANUAL',
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "isWinning" BOOLEAN NOT NULL DEFAULT false,
    "messageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bids_auctionId_lotId_createdAt_idx" ON "bids"("auctionId", "lotId", "createdAt");

-- CreateIndex
CREATE INDEX "bids_auctionId_lotId_amount_idx" ON "bids"("auctionId", "lotId", "amount");

-- CreateIndex
CREATE INDEX "bids_messageId_idx" ON "bids"("messageId");

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
