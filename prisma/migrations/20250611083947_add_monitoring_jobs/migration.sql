-- CreateTable
CREATE TABLE "monitoring_jobs" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastProcessedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPollingInterval" INTEGER NOT NULL DEFAULT 10000,
    "nextPageToken" TEXT,
    "auctionNotFoundCount" INTEGER NOT NULL DEFAULT 0,
    "lotNotFoundCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_jobs_isActive_idx" ON "monitoring_jobs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_jobs_auctionId_lotId_key" ON "monitoring_jobs"("auctionId", "lotId");
