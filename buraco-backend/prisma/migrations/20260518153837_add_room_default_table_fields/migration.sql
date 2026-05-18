-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "isDefaultTable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tableLabel" TEXT;
