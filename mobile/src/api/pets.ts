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

export type PetDto = {
  id: string;
  name: string;
  bondXp: number;
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

export type PetMeResponse = {
  pet: PetDto;
  cards: PetCardDto[];
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

export function getMyPet() {
  return api<PetMeResponse>('/pets/me');
}

export function scanPetCard(uid: string) {
  return api<ScanResponse>('/pets/scan', { method: 'POST', body: { uid } });
}

export function equipPetCard(cardId: string) {
  return api<EquipResponse>('/pets/equip', { method: 'POST', body: { cardId } });
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
};

export type PetChatHistoryResponse = {
  messages: PetChatMessage[];
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

// MP3 URL absolut pt expo-audio (backend serveste relative /tts-cache/...).
export function absolutePetAudioUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
