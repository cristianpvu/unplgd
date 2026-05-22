-- ProfileBackground: fundaluri live (clip MP4 loop muted). `videoUrl` e optional;
-- daca lipseste, mobile foloseste `imageUrl` ca ImageBackground static (fallback).

ALTER TABLE "ProfileBackground" ADD COLUMN "videoUrl" TEXT;
