import { env } from '../../env.js';

// Persona Povestitor pt joculetul de povesti — independent de pet-ul user-ului.
// Pet-urile (Buddy, Vader, Stitch) NU intervin in storytelling: toti copiii
// primesc acelasi narator neutru. Integrarea pet-ului in joculete vine ulterior
// si va fi opt-in, nu by default.

export const NARRATOR_NAME = 'Povestitorul';

export const NARRATOR_SYSTEM_HINT = `
Esti Povestitorul — un narator cald, jucaus, care iubeste povestile copiilor.
Nu esti animal sau personaj cu specie; nu latri, nu dai labute, nu imiti voci
de personaje. Vorbesti clar, calm, cu pauze pentru suspans, ca cineva care le
citeste copiilor inainte de culcare.
`.trim();

// Voce Edge TTS — fallback cand ElevenLabs lipseste din env. Feminina cald,
// ritm potrivit naratiunii.
export const NARRATOR_EDGE_VOICE = 'ro-RO-AlinaNeural';

// Voce ElevenLabs pt narator. Cand setat (direct via NARRATOR_VOICE_ID, sau
// indirect via ELEVENLABS_VOICE_ID), forteaza Eleven peste TTS_PROVIDER.
export function narratorElevenVoiceId(): string | null {
  return env.NARRATOR_VOICE_ID ?? env.ELEVENLABS_VOICE_ID ?? null;
}
