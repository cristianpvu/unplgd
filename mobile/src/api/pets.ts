import { api, API_BASE_URL } from './client';

export type PetSpeciesDto = {
  slug: string;
  name: string;
  imagePath: string | null;
  shortLore: string;
  tone: string;
  catchphrases: string[];
  interests: string[];
};

export type PetBondProgress = {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

export type PetDto = {
  id: string;
  name: string;
  bondXp: number;
  bond: PetBondProgress;
  species: PetSpeciesDto;
};

export type PetCardDto = {
  id: string;
  uid: string;
  nickname: string | null;
  claimedAt: string | null;
  equipped: boolean;
  species: PetSpeciesDto;
};

export type StarterDto = PetSpeciesDto & { equipped: boolean };

export type PetMeResponse = {
  pet: PetDto;
  cards: PetCardDto[];
  // Startere gratuite (Scout + Buddy). Cel auto-selectat e primul.
  starters: StarterDto[];
};

export type ScanResponse = {
  newClaim: boolean;
  pet: PetDto;
  card: PetCardDto;
};

export type EquipResponse = {
  pet: PetDto;
  card: PetCardDto;
};

export type EquipDefaultResponse = {
  pet: PetDto;
};

export function getMyPet() {
  return api<PetMeResponse>('/pets/me');
}

export function scanPetCard(uid: string) {
  return api<ScanResponse>('/pets/scan', { method: 'POST', body: { uid } });
}

export function equipPetCard(cardId: string) {
  return api<EquipResponse>('/pets/equip', { method: 'POST', body: { cardId } });
}

export function equipDefaultPet(slug?: string) {
  return api<EquipDefaultResponse>('/pets/equip-default', {
    method: 'POST',
    body: slug ? { slug } : {},
  });
}

export function renamePetCard(cardId: string, nickname: string) {
  return api<{ card: PetCardDto }>(`/pets/cards/${cardId}`, {
    method: 'PATCH',
    body: { nickname },
  });
}

// Construieste URL absolut catre PNG-ul speciei. Backend returneaza
// imagePath relativ ("/pets/<file>.png"); daca admin-ul a setat URL absolut
// (CDN extern) il pasam prin neschimbat.
export function petImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${API_BASE_URL}${imagePath}`;
}

// =====================================================================
// Chat AI cu pet-ul echipat
// =====================================================================

export type PetChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // Setat doar pe ultimul mesaj assistant din history (backend re-sintetizeaza
  // TTS la GET pt live mode). null pe restul si pe mesajele user.
  audioUrl: string | null;
};

export type PetChatIntro = {
  text: string;
  audioUrl: string | null;
  ttsProvider: 'eleven' | 'edge' | null;
};

export type PetChatHistoryResponse = {
  messages: PetChatMessage[];
  intro: PetChatIntro | null;
};

export type PetChatSendResponse = {
  reply: string;
  replyAudioUrl: string | null;
  ttsProvider: 'eleven' | 'edge' | null;
};

export function getPetChatHistory() {
  return api<PetChatHistoryResponse>('/pets/chat');
}

export function sendPetChat(message: string) {
  return api<PetChatSendResponse>('/pets/chat', {
    method: 'POST',
    body: { message },
  });
}

export function clearPetChat() {
  return api<void>('/pets/chat', { method: 'DELETE' });
}

// Daily hook — mesajul personalizat afisat in bubble-ul pe home. Generat o
// data pe zi pe baza activitatii ultimilor 48h.
export type PetDailyHookResponse = {
  text: string;
  generatedAt: string;
};

export function getPetDailyHook() {
  return api<PetDailyHookResponse>('/pets/daily-hook');
}

// MP3 URL absolut pt expo-audio (backend serveste relative /tts-cache/...).
export function absolutePetAudioUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
