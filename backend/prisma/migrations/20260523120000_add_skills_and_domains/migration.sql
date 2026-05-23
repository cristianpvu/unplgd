-- CreateTable: Domain (taxonomy hierarchica)
CREATE TABLE "Domain" (
    "slug" TEXT NOT NULL,
    "parentSlug" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'both',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "Domain_parentSlug_active_idx" ON "Domain"("parentSlug", "active");

-- CreateIndex
CREATE INDEX "Domain_kind_active_idx" ON "Domain"("kind", "active");

-- AddForeignKey (self-relation pe parent)
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_parentSlug_fkey" FOREIGN KEY ("parentSlug") REFERENCES "Domain"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: SkillXpTransaction
CREATE TABLE "SkillXpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillXpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillXpTransaction_userId_skill_createdAt_idx" ON "SkillXpTransaction"("userId", "skill", "createdAt");

-- CreateIndex (idempotency)
CREATE UNIQUE INDEX "SkillXpTransaction_userId_skill_sourceType_sourceId_key" ON "SkillXpTransaction"("userId", "skill", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "SkillXpTransaction" ADD CONSTRAINT "SkillXpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DomainXpTransaction
CREATE TABLE "DomainXpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domainSlug" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainXpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainXpTransaction_userId_domainSlug_createdAt_idx" ON "DomainXpTransaction"("userId", "domainSlug", "createdAt");

-- CreateIndex
CREATE INDEX "DomainXpTransaction_userId_createdAt_idx" ON "DomainXpTransaction"("userId", "createdAt");

-- CreateIndex (idempotency)
CREATE UNIQUE INDEX "DomainXpTransaction_userId_domainSlug_sourceType_sourceId_key" ON "DomainXpTransaction"("userId", "domainSlug", "sourceType", "sourceId");

-- AddForeignKey: user
ALTER TABLE "DomainXpTransaction" ADD CONSTRAINT "DomainXpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: domain
ALTER TABLE "DomainXpTransaction" ADD CONSTRAINT "DomainXpTransaction_domainSlug_fkey" FOREIGN KEY ("domainSlug") REFERENCES "Domain"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
