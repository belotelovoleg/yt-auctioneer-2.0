-- Add sellingStartedAt field to track when selling began for timestamp filtering
ALTER TABLE "lots" ADD COLUMN "sellingStartedAt" TIMESTAMP(3);
