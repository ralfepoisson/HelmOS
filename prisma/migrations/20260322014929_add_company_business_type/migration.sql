-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM (
    'PRODUCT',
    'SERVICE',
    'RESEARCH_AND_DEVELOPMENT',
    'MARKETPLACE',
    'PLATFORM',
    'AGENCY',
    'OTHER'
);

-- AlterTable
ALTER TABLE "companies"
ADD COLUMN "business_type" "BusinessType" NOT NULL DEFAULT 'PRODUCT';
