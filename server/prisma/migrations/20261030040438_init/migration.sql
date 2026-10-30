-- CreateEnum
CREATE TYPE "LeadRole" AS ENUM ('PRINCIPAL', 'DISTRICT_ADMIN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('RUNNING', 'COMPLETED');

-- CreateTable
CREATE TABLE "District" (
    "leaid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "leaType" TEXT,
    "schoolCount" INTEGER,
    "enrollment" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("leaid")
);

-- CreateTable
CREATE TABLE "School" (
    "ncessch" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "schoolType" TEXT,
    "level" TEXT,
    "gradeLow" TEXT,
    "gradeHigh" TEXT,
    "isCharter" BOOLEAN NOT NULL DEFAULT false,
    "enrollment" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("ncessch")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'RUNNING',
    "totalLeads" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "role" "LeadRole" NOT NULL,
    "adminName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "phone" TEXT,
    "districtId" TEXT NOT NULL,
    "schoolId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "processedAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_districtId_idx" ON "School"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sourceKey_key" ON "Lead"("sourceKey");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_role_idx" ON "Lead"("role");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("ncessch") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
