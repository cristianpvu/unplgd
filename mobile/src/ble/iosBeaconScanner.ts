import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

// Wrapper peste modulul nativ Swift `IBeaconScanner` (ios/modules/ibeacon-scanner).
// Exista doar pe iOS. Pe Android scaneaza-le pe ble-plx (manufacturerData parsing).
//
// De ce e nevoie: Apple ascunde iBeacon advertising packets din scanul generic
// CoreBluetooth (deci ble-plx pe iOS NU vede iBeacons emise de Android sau de
// alte iPhone-uri). Singurul API public care le returneaza e CLLocationManager
// .startRangingBeaconsSatisfyingConstraint — pe care il expunem aici.

type AuthorizationStatus =
  | 'always'
  | 'whenInUse'
  | 'denied'
  | 'restricted'
  | 'notDetermined';

export type RangedBeacon = {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  accuracy: number;
};

export type BeaconsRangedEvent = {
  uuid: string;
  beacons: RangedBeacon[];
};

type IBeaconScannerNative = {
  requestPermission(): Promise<AuthorizationStatus>;
  getAuthorizationStatus(): Promise<AuthorizationStatus>;
  startRanging(uuid: string): Promise<void>;
  stopRanging(uuid: string): Promise<void>;
  stopAll(): Promise<void>;
};

const Native: IBeaconScannerNative | undefined =
  Platform.OS === 'ios' ? NativeModules.IBeaconScanner : undefined;

const emitter =
  Platform.OS === 'ios' && NativeModules.IBeaconScanner
    ? new NativeEventEmitter(NativeModules.IBeaconScanner)
    : null;

export const iosBeaconScanner = {
  isAvailable: Platform.OS === 'ios' && !!Native,
  requestPermission(): Promise<AuthorizationStatus> {
    if (!Native) return Promise.resolve('notDetermined');
    return Native.requestPermission();
  },
  getAuthorizationStatus(): Promise<AuthorizationStatus> {
    if (!Native) return Promise.resolve('notDetermined');
    return Native.getAuthorizationStatus();
  },
  startRanging(uuid: string): Promise<void> {
    if (!Native) return Promise.resolve();
    return Native.startRanging(uuid);
  },
  stopRanging(uuid: string): Promise<void> {
    if (!Native) return Promise.resolve();
    return Native.stopRanging(uuid);
  },
  stopAll(): Promise<void> {
    if (!Native) return Promise.resolve();
    return Native.stopAll();
  },
  onBeaconsRanged(cb: (e: BeaconsRangedEvent) => void): { remove: () => void } {
    if (!emitter) return { remove: () => {} };
    const sub = emitter.addListener('onBeaconsRanged', cb);
    return { remove: () => sub.remove() };
  },
  onAuthorizationChanged(cb: (status: AuthorizationStatus) => void): { remove: () => void } {
    if (!emitter) return { remove: () => {} };
    const sub = emitter.addListener('onAuthorizationChanged', (e: { status: AuthorizationStatus }) =>
      cb(e.status),
    );
    return { remove: () => sub.remove() };
  },
};
