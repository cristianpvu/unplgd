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
};

export type AuthResponse = {
  token: string;
  user: User;
};
