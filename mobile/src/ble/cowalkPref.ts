import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferinta locala "cauta automat prieteni in apropiere prin BLE". Cand e
// false, presence engine-ul nu porneste la login si user-ul ramane invizibil
// pentru ceilalti. Persistat in AsyncStorage ca sa supravietuiasca restart.
const KEY = 'cowalk:enabled';

let cached = true;
let loaded = false;
const subscribers = new Set<(v: boolean) => void>();

function notify() {
  for (const fn of subscribers) fn(cached);
}

export async function loadCowalkEnabled(): Promise<boolean> {
  if (loaded) return cached;
  try {
    const v = await AsyncStorage.getItem(KEY);
    cached = v === null ? true : v === '1';
  } catch {
    cached = true;
  }
  loaded = true;
  notify();
  return cached;
}

export function getCowalkEnabledCached(): boolean {
  return cached;
}

export async function setCowalkEnabled(value: boolean): Promise<void> {
  cached = value;
  loaded = true;
  notify();
  try {
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // ignoram esecul de scriere — preferinta ramane in memorie pana la restart
  }
}

// Hook React: hydrate-eaza din storage la mount + re-renderizeaza la fiecare
// schimbare ulterioara (toggle din alt screen). Inainte de hydrate returnam
// optimist `true` (defaultul), care e si cazul comun pentru utilizatorii noi.
export function useCowalkEnabled(): boolean {
  const [value, setValue] = useState(cached);
  useEffect(() => {
    if (!loaded) void loadCowalkEnabled().then(setValue);
    const sub = (v: boolean) => setValue(v);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  return value;
}
