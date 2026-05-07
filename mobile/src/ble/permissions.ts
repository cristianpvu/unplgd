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
//   pt Bluetooth la primul access. Pt iBeacon ranging Apple cere si Location
//   "When in Use", deci il cerem aici proactiv (parsam manufacturer data ca
//   iBeacon dar central scan-ul standard nu cere strict Location). Tinem
//   cererea ca un guard preventiv.
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
      if (
        p === PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ||
        p === PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
      ) {
        continue;
      }
      return 'denied';
    }
  }
  return 'granted';
}
