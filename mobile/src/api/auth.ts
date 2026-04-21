import { api } from './client';
import type { AuthResponse } from './types';

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  birthDate: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export function register(input: RegisterInput): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/register', { method: 'POST', body: input, auth: false });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false });
}
