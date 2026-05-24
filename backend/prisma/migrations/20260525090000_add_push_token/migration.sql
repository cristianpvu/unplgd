-- Push token columns on User. Nullable — useri vechi nu au token pana
-- nu se relogheaza pe mobile cu noua versiune.

ALTER TABLE "User"
  ADD COLUMN "pushToken" TEXT,
  ADD COLUMN "pushTokenUpdatedAt" TIMESTAMP(3);
