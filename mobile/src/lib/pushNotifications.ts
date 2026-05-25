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
    const data = response.notification.request.content.data ?? {};
    handleNotificationTap(data);
  });
  return () => sub.remove();
}

function handleNotificationTap(data: Record<string, unknown>) {
  const kind = data.kind as string | undefined;
  switch (kind) {
    case 'park_hint':
      // Deschide chat-ul cu pet-ul — acolo conversatia poate continua firul.
      router.push('/(app)/chat');
      break;
    case 'daily_quests':
      router.push('/(app)/quests');
      break;
    default:
      // Fallback: deschide home si lasa user-ul sa vada notificarea in sheet.
      router.push('/(app)');
      break;
  }
}
