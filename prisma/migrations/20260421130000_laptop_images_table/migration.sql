-- CreateEnum
CREATE TYPE "LaptopImageKind" AS ENUM ('FEATURED', 'GALLERY');

-- CreateTable
CREATE TABLE "LaptopImage" (
    "id" UUID NOT NULL,
    "laptopId" UUID NOT NULL,
    "kind" "LaptopImageKind" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaptopImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaptopImage_laptopId_idx" ON "LaptopImage"("laptopId");

-- CreateIndex
CREATE UNIQUE INDEX "LaptopImage_laptopId_kind_position_key" ON "LaptopImage"("laptopId", "kind", "position");

-- AddForeignKey
ALTER TABLE "LaptopImage" ADD CONSTRAINT "LaptopImage_laptopId_fkey" FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy single-image column
ALTER TABLE "Laptop" DROP COLUMN "imageUrl";
