export type User = {
  id: string;
  email: string;
  name: string;
  birthDate: string;
  xp: number;
  level: number;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};
