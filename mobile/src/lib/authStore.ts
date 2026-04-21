import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'unplgd_jwt';

let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const value = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedToken = value;
  return value;
}

export async function saveToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function getCachedToken(): string | null {
  return cachedToken;
}
