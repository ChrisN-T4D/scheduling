-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "GlobalSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyRule" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "WeeklyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "startUtc" TIMESTAMP(3) NOT NULL,
    "endUtc" TIMESTAMP(3) NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "notes" TEXT,
    "zoomMeetingId" TEXT,
    "zoomJoinUrl" TEXT,
    "graphEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_startUtc_idx" ON "Booking"("startUtc");

-- CreateIndex
CREATE INDEX "Booking_endUtc_idx" ON "Booking"("endUtc");

-- CreateIndex
CREATE UNIQUE INDEX "StoredCredential_provider_key" ON "StoredCredential"("provider");
