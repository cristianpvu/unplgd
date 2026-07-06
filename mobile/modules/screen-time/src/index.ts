import { NativeModules, Platform } from 'react-native';

// Wrapper JS uniform peste modulul nativ ScreenTime. Disponibil DOAR pe Android
// (UsageStatsManager). Pe iOS modulul lipseste → isAvailable=false si ecranul
// face gating ("doar Android deocamdata").
//
// Ferestrele de timp se calculeaza pe ORA LOCALA a device-ului (UsageStatsManager
// raporteaza pe timezone-ul telefonului), deci ziua 'YYYY-MM-DD' aici e ziua
// locala — coincide cu Europe/Bucharest pentru userii din RO.

type Native = {
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): Promise<boolean>;
  getScreenTimeMinutes(startMs: number, endMs: number): Promise<number>;
};

const Native: Native | undefined =
  Platform.OS === 'android' ? NativeModules.ScreenTime : undefined;

// Miezul noptii local pentru un 'YYYY-MM-DD' (sau azi daca lipseste).
function localDayStart(day?: string): Date {
  if (!day) {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

// 'YYYY-MM-DD' pe ora locala a device-ului.
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export const screenTime = {
  isAvailable: !!Native,

  async hasPermission(): Promise<boolean> {
    if (!Native) return false;
    return Native.hasUsageAccess();
  },

  // Deschide ecranul Settings → Usage access. User-ul activeaza manual; la
  // revenirea in app re-verificam hasPermission().
  async openSettings(): Promise<boolean> {
    if (!Native) return false;
    return Native.openUsageAccessSettings();
  },

  // Minute de utilizare intr-o fereastra. Returneaza null daca lipseste
  // permisiunea sau modulul (caller-ul nu mai raporteaza).
  async minutesForRange(start: Date, end: Date): Promise<number | null> {
    if (!Native) return null;
    const m = await Native.getScreenTimeMinutes(start.getTime(), end.getTime());
    return m < 0 ? null : Math.round(m);
  },

  // Minute pentru o zi calendaristica locala. Pentru ziua curenta limiteaza la
  // momentul curent (nu numara viitorul).
  async minutesForDay(day?: string): Promise<number | null> {
    const start = localDayStart(day);
    const dayEnd = new Date(start);
    dayEnd.setDate(start.getDate() + 1);
    const now = new Date();
    const end = dayEnd > now ? now : dayEnd;
    return this.minutesForRange(start, end);
  },

  // Minutele de azi pana acum.
  async todayMinutes(): Promise<number | null> {
    return this.minutesForDay();
  },
};
