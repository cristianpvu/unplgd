import { screenTime, localDayKey } from 'screen-time';
import { reportScreenTime } from '../api/screentime';

// Raporteaza screen time-ul la backend. Trimite IERI (total final) + AZI (running)
// ca finalizarea saptamanala sa aiba date complete chiar daca user-ul nu deschide
// leaderboard-ul zilnic. Android-only + permission-gated; fail-soft pe orice
// eroare (nu vrem sa stricam boot-ul pt un feature optional).
export async function syncScreenTime(): Promise<void> {
  try {
    if (!screenTime.isAvailable) return;
    if (!(await screenTime.hasPermission())) return;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);
    const days = [localDayKey(yesterday), localDayKey(now)];

    for (const day of days) {
      const minutes = await screenTime.minutesForDay(day);
      if (minutes == null) continue;
      await reportScreenTime({ day, minutes, source: 'android_usagestats' });
    }
  } catch {
    // fail-soft — feature optional, nu blocam nimic.
  }
}
