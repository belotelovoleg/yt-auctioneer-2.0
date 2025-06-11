-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "monitoring_logs" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER,
    "lotId" INTEGER,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_logs_auctionId_lotId_createdAt_idx" ON "monitoring_logs"("auctionId", "lotId", "createdAt");

-- CreateIndex
CREATE INDEX "monitoring_logs_level_createdAt_idx" ON "monitoring_logs"("level", "createdAt");
