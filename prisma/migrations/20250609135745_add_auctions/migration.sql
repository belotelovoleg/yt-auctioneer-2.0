-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'READY', 'STARTED', 'FINISHED');

-- CreateTable
CREATE TABLE "auctions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "youtubeChannelId" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
