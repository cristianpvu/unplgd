-- AlterTable
ALTER TABLE "PhoneDownSession" ADD COLUMN     "invitedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
