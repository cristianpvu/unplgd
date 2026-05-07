import { Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

let started = false;

async function ensureStarted() {
  if (started) return;
  await NfcManager.start();
  started = true;
}

export async function isNfcAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    await ensureStarted();
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    // isEnabled e doar pe Android (toggle in setari). Pe iOS NFC e mereu enabled
    // daca device-ul are hardware (iPhone 7+) si app-ul are entitlement.
    if (Platform.OS === 'android') {
      return await NfcManager.isEnabled();
    }
    return true;
  } catch {
    return false;
  }
}

// Citeste UID-ul unui tag NFC. Returneaza UID-ul ca hex lowercase
// (ex: "04a1b2c3d4e5f6").
//
// Android: NfcA functioneaza pe orice NTAG (213/215/216) indiferent daca tag-ul
// e NDEF-formatat. Citirea e in background, fara UI sheet.
//
// iOS: MifareIOS (NFCMiFareTag) — NTAG21x sunt bazate pe Mifare Ultralight, deci
// asta e tech-ul corect. iOS arata automat un system sheet ("Apropie cardul"),
// se inchide cand tag-ul e citit sau user-ul anuleaza.
export async function readTagUid(opts?: { alertMessage?: string }): Promise<string> {
  await ensureStarted();
  const tech = Platform.OS === 'ios' ? NfcTech.MifareIOS : NfcTech.NfcA;
  try {
    await NfcManager.requestTechnology(tech, {
      alertMessage:
        opts?.alertMessage ?? 'Apropie cardul de partea de sus a iPhone-ului',
      invalidateAfterFirstRead: true,
    });
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('Nu am putut citi UID-ul tag-ului');
    if (Platform.OS === 'ios') {
      await NfcManager.setAlertMessageIOS('Card citit!').catch(() => {});
    }
    return tag.id.toLowerCase();
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export function cancelTagRead() {
  NfcManager.cancelTechnologyRequest().catch(() => {});
}
