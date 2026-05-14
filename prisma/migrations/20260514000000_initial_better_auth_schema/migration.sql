-- CreateEnum
CREATE TYPE "RecordingPurchaseStatus" AS ENUM ('free_window', 'purchased', 'expired', 'deleted');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'expert', 'admin');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('pending', 'active', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "ExpertStatus" AS ENUM ('pending', 'approved', 'suspended', 'rejected');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('percentage', 'flat');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'held', 'released', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "PhotoStage" AS ENUM ('pre', 'during');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "phone" TEXT,
    "stripeCustomerId" TEXT,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "feeType" "FeeType" NOT NULL DEFAULT 'percentage',
    "feeValue" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "feeFlatTiers" JSONB,
    "rateMin" DECIMAL(10,2) NOT NULL DEFAULT 25,
    "rateMax" DECIMAL(10,2) NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_overrides" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "overrideValue" DECIMAL(10,4) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_profiles" (
    "id" TEXT NOT NULL,
    "status" "ExpertStatus" NOT NULL DEFAULT 'pending',
    "bio" TEXT,
    "yearsExperience" INTEGER,
    "certifications" TEXT[],
    "stripeConnectId" TEXT,
    "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "checkrCandidateId" TEXT,
    "checkrReportId" TEXT,
    "backgroundCheckPassed" BOOLEAN,
    "hourlyRate" DECIMAL(10,2),
    "categoryIds" TEXT[],
    "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expertId" TEXT,
    "categoryId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "durationBilledMinutes" INTEGER,
    "problemTitle" TEXT,
    "problemDescription" TEXT,
    "expertHourlyRate" DECIMAL(10,2),
    "platformFeeType" "FeeType",
    "platformFeeValue" DECIMAL(10,4),
    "sessionSubtotal" DECIMAL(10,2),
    "platformFeeAmount" DECIMAL(10,2),
    "expertPayout" DECIMAL(10,2),
    "platformFee" DECIMAL(10,2),
    "customerTotal" DECIMAL(10,2),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "customerNotes" TEXT,
    "expertNotes" TEXT,
    "notesUpdatedAt" TIMESTAMP(3),
    "partsNeeded" JSONB,
    "cancelledReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "stage" "PhotoStage" NOT NULL DEFAULT 'pre',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "r2KeyOriginal" TEXT,
    "r2KeyBackup" TEXT,
    "durationSeconds" INTEGER,
    "fileSizeBytes" BIGINT,
    "expiresAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseStatus" "RecordingPurchaseStatus" NOT NULL DEFAULT 'free_window',
    "stripePaymentIntentId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "purchasedBy" TEXT,
    "priceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flaggedReason" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_stripeCustomerId_key" ON "auth_users"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "expert_profiles_stripeConnectId_key" ON "expert_profiles"("stripeConnectId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_sessionId_reviewerId_key" ON "reviews"("sessionId", "reviewerId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_overrides" ADD CONSTRAINT "fee_overrides_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_purchasedBy_fkey" FOREIGN KEY ("purchasedBy") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
