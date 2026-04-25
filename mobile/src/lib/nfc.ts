import { Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

let started = false;

async function ensureStarted() {
  if (started) return;
  await NfcManager.start();
  started = true;
}

export async function isNfcAvailable(): Promise<boolean> {
  // iOS necesita entitlement Apple Developer pt NFC. Pe MVP scoatem flow-ul de
  // pe iOS — backend-ul accepta UID-uri provisionate oricum, doar UI-ul e gated.
  if (Platform.OS !== 'android') return false;
  try {
    await ensureStarted();
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

// Citeste UID-ul unui tag NFC. Pe Android NfcA functioneaza pe orice NTAG
// (213/215/216) indiferent daca tag-ul e NDEF-formatat. Returneaza UID-ul ca
// hex lowercase (ex: "04a1b2c3d4e5f6").
export async function readTagUid(): Promise<string> {
  await ensureStarted();
  try {
    await NfcManager.requestTechnology(NfcTech.NfcA);
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('Nu am putut citi UID-ul tag-ului');
    return tag.id.toLowerCase();
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export function cancelTagRead() {
  NfcManager.cancelTechnologyRequest().catch(() => {});
}
