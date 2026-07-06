-- ScreenTimeDay: raport zilnic de screen time total al device-ului, per user.
-- `day` string 'YYYY-MM-DD' Europe/Bucharest, upsert pe (userId, day).
CREATE TABLE "ScreenTimeDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'android_usagestats',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenTimeDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreenTimeDay_userId_day_key"
  ON "ScreenTimeDay"("userId", "day");

CREATE INDEX "ScreenTimeDay_userId_day_idx"
  ON "ScreenTimeDay"("userId", "day");

-- ScreenTimeWeek: rezultat finalizat al unei saptamani ISO, per user. Creat
-- lazy la primul GET /leaderboard din saptamana noua. Idempotent prin unique
-- (userId, weekKey).
CREATE TABLE "ScreenTimeWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "avgMinutes" INTEGER NOT NULL,
    "daysReported" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "groupSize" INTEGER NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenTimeWeek_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreenTimeWeek_userId_weekKey_key"
  ON "ScreenTimeWeek"("userId", "weekKey");

CREATE INDEX "ScreenTimeWeek_userId_weekKey_idx"
  ON "ScreenTimeWeek"("userId", "weekKey");

ALTER TABLE "ScreenTimeDay"
  ADD CONSTRAINT "ScreenTimeDay_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreenTimeWeek"
  ADD CONSTRAINT "ScreenTimeWeek_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
