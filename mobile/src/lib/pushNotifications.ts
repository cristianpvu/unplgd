import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api/client';

// Comportament cand notificarea ajunge in foreground (app deschis activ).
// Setam sa apara ca banner — kid-ul vede notificarea chiar daca app-ul e
// deschis, dar nu prea agresiv.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;

/**
 * Inregistreaza push token-ul cu backend-ul. De apelat la login si la
 * fiecare schimbare de permissions.
 *
 * Returneaza token-ul daca a fost inregistrat cu success, null altfel
 * (permission refuzat, emulator, etc.).
 *
 * SAFE re-call: cache local — daca acelasi token e deja inregistrat in
 * session-ul curent, nu mai apelam backend-ul.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push functioneaza doar pe device real, NU pe emulator/simulator.
  if (!Device.isDevice) return null;

  // Verifica + cere permission daca nu deja granted.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Android: setup channel "park_hints" cu nume legibil + culoare. Channel-ul
  // permite user-ului sa toggle-ze tipuri de notificari independent in Setari.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('park_hints', {
      name: 'Sugestii de intalniri',
      description: 'Pet-ul tau iti spune unde sa mergi sa intalnesti copii ca tine.',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#7DCEA0',
      vibrationPattern: [0, 250, 250, 250],
    });
    // Canal separat pentru invitatii intre prieteni (Phone Down, co-walk).
    // User-ul le poate toggla independent de sugestiile de parc in Setari.
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Invitatii de la prieteni',
      description: 'Cand un prieten te invita la un joc (Last Phone Standing).',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#7C5CFC',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // projectId din EAS config — necesar in bare/dev build pt ca SDK-ul sa
  // stie pe care proiect Expo sa inregistreze token-ul.
  //
  // Constants.expoConfig.extra e populat doar dupa rebuild nativ care embed
  // app.json proaspat. In dev clients vechi e undefined, deci tinem si un
  // fallback hardcodat (corespunde proiectului @dinedroid/unplgd in EAS).
  const PROJECT_ID = '5aa71491-3e8b-491a-b3f7-589bf77fb069';
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    PROJECT_ID;

  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch {
    return null;
  }
  const token = tokenData.data;

  // Cache local — daca-i acelasi token cu cel inregistrat anterior in session,
  // nu mai apelam backend-ul.
  if (token === registeredToken) return token;

  try {
    await api<{ ok: true }>('/me/push-token', {
      method: 'POST',
      body: { token },
    });
    registeredToken = token;
    return token;
  } catch {
    return null;
  }
}

/**
 * Inregistreaza listener-ele pentru tap pe notificare. De apelat o singura
 * data la pornirea app-ului. Returneaza cleanup function.
 */
export function registerNotificationTapListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response);
  });
  return () => sub.remove();
}

function handleNotificationTap(response: Notifications.NotificationResponse) {
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;
  // La push, payload-ul backend e aplatizat in `data`; title/body stau in content.
  routeForNotification({
    kind: data.kind as string | undefined,
    title: content.title ?? undefined,
    body: content.body ?? undefined,
    payload: data,
  });
}

export type NotificationLike = {
  kind?: string;
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
};

/**
 * Sursa unica de adevar pentru rutarea unei notificari. Folosita atat la tap pe
 * push (background) cat si la tap pe notificarea din sheet-ul in-app, ca
 * destinatia sa fie mereu identica.
 */
export function routeForNotification(n: NotificationLike) {
  const p = n.payload ?? {};
  switch (n.kind) {
    case 'park_hint':
      // Modal cu textul complet + buton de indicatii spre parc.
      router.push({
        pathname: '/(app)/park-hint',
        params: {
          title: n.title ?? 'Idee pentru tine',
          body: n.body ?? '',
          parkName: str(p.parkName),
          lat: str(p.lat),
          lng: str(p.lng),
        },
      });
      break;
    case 'daily_quests':
      router.push('/(app)/quests');
      break;
    case 'phonedown_invite':
      // Deschidem ecranul Last Phone Standing pe sesiunea invitata. `join=1`
      // semnaleaza ecranului sa adere automat (invitatul nu e inca participant,
      // deci fetch-ul de sesiune ar da 403 fara join).
      router.push({
        pathname: '/(app)/phonedown',
        params: { sessionId: str(p.sessionId), join: '1' },
      });
      break;
    default:
      // Fallback: deschide home (notificarea ramane vizibila in sheet).
      router.push('/(app)');
      break;
  }
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
