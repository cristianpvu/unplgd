-- CreateTable
CREATE TABLE "ChestTierConfig" (
    "tier" "ChestTier" NOT NULL,
    "minDurationMs" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "xpBase" INTEGER NOT NULL,
    "weightCommon" INTEGER NOT NULL DEFAULT 0,
    "weightRare" INTEGER NOT NULL DEFAULT 0,
    "weightEpic" INTEGER NOT NULL DEFAULT 0,
    "weightLegendary" INTEGER NOT NULL DEFAULT 0,
    "upgradeToTier" "ChestTier",
    "guaranteedLegendary" INTEGER NOT NULL DEFAULT 0,
    "guaranteedEpic" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChestTierConfig_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "RarityDuplicateXp" (
    "rarity" "Rarity" NOT NULL,
    "xp" INTEGER NOT NULL,

    CONSTRAINT "RarityDuplicateXp_pkey" PRIMARY KEY ("rarity")
);
