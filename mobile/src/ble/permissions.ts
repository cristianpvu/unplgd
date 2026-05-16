import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';

export type BlePermissionResult = 'granted' | 'denied' | 'unavailable';

// Cere runtime permisiunile BLE/Location.
// - Android 12+: BLUETOOTH_SCAN/CONNECT/ADVERTISE + ACCESS_FINE_LOCATION
//   (FINE_LOCATION e cerut pe orice versiune cand vrem sa primim manufacturer
//   data nestripped de la device-uri scanate, decat daca pasam neverForLocation —
//   pe care NU il pasam ca sa pastram un singur cod path comun).
// - Android 11-: doar ACCESS_FINE_LOCATION.
// - iOS: scan-ul GATT (ble-plx / CoreBluetooth) prompt-uieste singur dialogul
//   pt Bluetooth la primul access. Cerem si Location "When in Use" proactiv
//   ca guard preventiv — unele API-uri Apple (CLLocationManager pt geofencing
//   viitor, region monitoring) cer Location, si vrem un singur prompt up-front.
export async function requestBlePermissions(): Promise<BlePermissionResult> {
  if (Platform.OS === 'ios') {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return 'denied';
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  if (Platform.OS !== 'android') return 'unavailable';

  const sdk = Number(Platform.Version);
  const perms: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (sdk >= 29) {
    // Pedometru: pe Android 10+ ACTIVITY_RECOGNITION e dangerous runtime
    // permission. Fara prompt explicit, expo-sensors Pedometer pare ca merge
    // (isAvailableAsync poate returna true) dar watchStepCount nu emite
    // niciodata callback → anti-cheat-ul de pasi pica silentios pe Android.
    perms.push(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
  }
  if (sdk >= 31) {
    perms.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
  }
  if (sdk >= 33) {
    perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = (await PermissionsAndroid.requestMultiple(perms as any)) as Record<
    string,
    string
  >;
  for (const p of perms) {
    if (result[p] !== PermissionsAndroid.RESULTS.GRANTED) {
      // POST_NOTIFICATIONS e cosmetic (notificare foreground service); permitem
      // sa lipseasca. BLUETOOTH_ADVERTISE NU e optional pe Android 12+ — fara
      // ea, BluetoothLeAdvertiser arunca SecurityException si peer-ii nu ne vad.
      // ACTIVITY_RECOGNITION e doar pt anti-cheat-ul de pasi — daca e refuzata,
      // BLE si co-walk detection functioneaza dar user-ul nu va primi XP.
      if (
        p === PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ||
        p === PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
      ) {
        continue;
      }
      // eslint-disable-next-line no-console
      console.warn(`[ble-perm] denied: ${p}`);
      return 'denied';
    }
  }
  return 'granted';
}
