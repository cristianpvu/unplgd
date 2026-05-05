-- Per-species ElevenLabs voice override. Cand setat, ruta /pets/chat
-- foloseste aceasta voce in locul ELEVENLABS_VOICE_ID din env.
ALTER TABLE "PetSpecies" ADD COLUMN "elevenVoiceId" TEXT;
