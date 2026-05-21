-- CreateTable
CREATE TABLE "BondXpTransaction" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondXpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BondXpTransaction_petId_createdAt_idx" ON "BondXpTransaction"("petId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BondXpTransaction_petId_sourceType_sourceId_key" ON "BondXpTransaction"("petId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "BondXpTransaction" ADD CONSTRAINT "BondXpTransaction_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

