import { api } from './client';
import type { User } from './types';

export function getMe(): Promise<User> {
  return api<User>('/me');
}
