-- CreateTable
CREATE TABLE "lots" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "auctionId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photo" TEXT,
    "startingPrice" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "priceStep" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    "timer" INTEGER NOT NULL DEFAULT 120,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
