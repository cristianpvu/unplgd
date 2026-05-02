import { Platform, PermissionsAndroid } from 'react-native';
import Beacon from 'react-native-beacon-kit';

export type BlePermissionResult = 'granted' | 'denied' | 'unavailable';

// Cere runtime permisiunile BLE/Location.
// - Android 12+: BLUETOOTH_SCAN/CONNECT/ADVERTISE + ACCESS_FINE_LOCATION (iBeacon
//   ranging cere location pe orice versiune Android — nu poti opta out cum poti
//   pt scan generic prin neverForLocation).
// - Android 11-: doar ACCESS_FINE_LOCATION.
// - iOS: beacon-kit cere Core Location la primul ranging; cerem aici proactiv
//   permisiunea via Beacon.checkPermissions (re-foloseste prompt-ul nativ daca
//   nu a fost dat inca).
export async function requestBlePermissions(): Promise<BlePermissionResult> {
  if (Platform.OS === 'ios') {
    try {
      const ok = await Beacon.checkPermissions();
      return ok ? 'granted' : 'denied';
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
      // POST_NOTIFICATIONS si BLUETOOTH_ADVERTISE nu sunt blocante: pot da denied
      // si tot scanam (foreground service ramane activ, doar fara icon).
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
