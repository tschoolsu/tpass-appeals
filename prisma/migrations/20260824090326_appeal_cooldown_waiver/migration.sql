-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN     "cooldownWaivedAt" TIMESTAMP(3),
ADD COLUMN     "cooldownWaivedBy" TEXT;
