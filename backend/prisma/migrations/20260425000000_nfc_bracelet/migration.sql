-- CreateTable
CREATE TABLE "NfcBracelet" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcBracelet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfcBracelet_uid_key" ON "NfcBracelet"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "NfcBracelet_userId_key" ON "NfcBracelet"("userId");

-- AddForeignKey
ALTER TABLE "NfcBracelet" ADD CONSTRAINT "NfcBracelet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
