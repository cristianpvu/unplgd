import type { PetSummary } from './friends';

export type User = {
  id: string;
  email: string;
  name: string;
  birthDate: string;
  xp: number;
  level: number;
  createdAt: string;
  pet: PetSummary | null;
  // Fundalul de profil selectat — folosit ca background fullscreen pe home.
  // videoUrl optional (clip MP4 loop muted); imageUrl mereu prezent (poster).
  background: {
    key: string;
    name: string;
    imageUrl: string;
    videoUrl: string | null;
    tier: number;
  } | null;
};

export type AuthResponse = {
  token: string;
  user: User;
};
