import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from 'react-native';

// Wrapper JS uniform peste modulul nativ CallDetector. iOS porneste
// observer-ul automat la subscribe; Android cere startListening() explicit
// (gard fata de bateria si runtime permission READ_PHONE_STATE).
//
// Folosit la Phone Down pentru a intra in pauza cand suna parintii in loc
// sa penalizam user-ul cu pierderea sesiunii.

type CallStatePayload = { inCall: boolean };

type Native = {
  getCurrentState(): Promise<CallStatePayload>;
  requestPermission(): Promise<boolean>;
  startListening?(): Promise<boolean>;
  stopListening?(): Promise<boolean>;
};

const Native: Native | undefined = NativeModules.CallDetector;
const emitter = Native ? new NativeEventEmitter(NativeModules.CallDetector) : null;

export type CallListener = (inCall: boolean) => void;

async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
  );
  if (granted) return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    {
      title: 'Detectie apel',
      message:
        'Phone Down nu te penalizeaza cand suna parintii. Pentru asta avem nevoie sa stim cand telefonul suna.',
      buttonPositive: 'OK',
      buttonNegative: 'Mai tarziu',
    },
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export const callDetector = {
  isAvailable: !!Native,

  async ensurePermission(): Promise<boolean> {
    if (!Native) return false;
    return ensureAndroidPermission();
  },

  // Porneste ascultarea event-urilor. Pe Android cere si permisiunea daca
  // lipseste. Returneaza true daca ascultarea e activa.
  async start(): Promise<boolean> {
    if (!Native) return false;
    const ok = await ensureAndroidPermission();
    if (!ok) return false;
    if (Native.startListening) {
      return Native.startListening();
    }
    return true;
  },

  async stop(): Promise<void> {
    if (!Native?.stopListening) return;
    await Native.stopListening();
  },

  async getCurrentState(): Promise<boolean> {
    if (!Native) return false;
    const r = await Native.getCurrentState();
    return !!r.inCall;
  },

  // Aboneaza-te la schimbarile de stare a apelului. Returneaza un
  // unsubscriber — apeleaza-l in cleanup-ul componentei.
  addListener(cb: CallListener): EmitterSubscription | null {
    if (!emitter) return null;
    const sub = emitter.addListener('callStateChanged', (e: CallStatePayload) => {
      cb(!!e?.inCall);
    });
    return sub;
  },
};
