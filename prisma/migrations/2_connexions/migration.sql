-- AlterTable
ALTER TABLE "ProjectRequest" ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'direct';

-- CreateTable
CREATE TABLE "Integration" (
    "channel" TEXT NOT NULL,
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "account" TEXT,
    "accountId" TEXT,
    "accountName" TEXT,
    "accountAvatar" TEXT,
    "secret" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "appId" TEXT,
    "appSecret" TEXT,
    "verifyToken" TEXT,
    "cursor" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '',
    "subject" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("channel")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "autoRepliedAt" TIMESTAMP(3),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "firstClickAt" TIMESTAMP(3),
    "lastClickAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "externalId" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_token_key" ON "Lead"("token");

-- CreateIndex
CREATE INDEX "Lead_lastMessageAt_idx" ON "Lead"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_channel_externalId_key" ON "Lead"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadMessage_externalId_key" ON "LeadMessage"("externalId");

-- CreateIndex
CREATE INDEX "LeadMessage_leadId_sentAt_idx" ON "LeadMessage"("leadId", "sentAt");

-- CreateIndex
CREATE INDEX "ProjectRequest_leadId_idx" ON "ProjectRequest"("leadId");

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
