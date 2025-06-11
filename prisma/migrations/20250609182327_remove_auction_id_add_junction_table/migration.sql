/*
  Warnings:

  - You are about to drop the column `auctionId` on the `lots` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "lots" DROP CONSTRAINT "lots_auctionId_fkey";

-- AlterTable
ALTER TABLE "lots" DROP COLUMN "auctionId";

-- CreateTable
CREATE TABLE "auction_lots" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auction_lots_auctionId_lotId_key" ON "auction_lots"("auctionId", "lotId");

-- AddForeignKey
ALTER TABLE "auction_lots" ADD CONSTRAINT "auction_lots_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_lots" ADD CONSTRAINT "auction_lots_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
