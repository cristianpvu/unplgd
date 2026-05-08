import { NativeModules, Platform } from 'react-native';

// Wrapper JS uniform peste modulul nativ BlePresence (iOS Swift + Android
// Kotlin). API simetric pentru advertise — scan ramane in mana ble-plx pe
// ambele platforme (citeste localName pe iOS-emis si serviceData pe
// Android-emis).

type AdvertiseState = 'poweredOn' | 'poweredOff' | 'unauthorized' | 'unsupported' | 'resetting' | 'unknown';

type AdvertiseStatus = {
  state: AdvertiseState;
  isAdvertising: boolean;
  lastError: string | null;
};

type Native = {
  startAdvertising(serviceUuid: string, localName: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  getState(): Promise<AdvertiseStatus>;
};

const Native: Native | undefined = NativeModules.BlePresence;

export const blePresence = {
  isAvailable: !!Native,
  platform: Platform.OS,
  startAdvertising(serviceUuid: string, token: string): Promise<void> {
    if (!Native) return Promise.resolve();
    return Native.startAdvertising(serviceUuid, token);
  },
  stopAdvertising(): Promise<void> {
    if (!Native) return Promise.resolve();
    return Native.stopAdvertising();
  },
  async getState(): Promise<AdvertiseStatus> {
    if (!Native) {
      return { state: 'unsupported', isAdvertising: false, lastError: null };
    }
    return Native.getState();
  },
};
