// Leaderboard "anti-ecran" — device-ul raporteaza screen time-ul zilnic,
// backendul claseaza in cercul de prieteni si premiaza saptamanal (mai putin
// timp = loc mai bun = mai mult XP).

import { api } from './client';

export type ScreenTimeEntry = {
  rank: number;
  userId: string;
  name: string;
  level: number;
  avatarSvg: string | null;
  avgMinutes: number;
  daysReported: number;
  todayMinutes: number;
  isMe: boolean;
};

export type ScreenTimeWeekResult = {
  weekKey: string;
  rank: number;
  groupSize: number;
  avgMinutes: number;
  daysReported: number;
  xpAwarded: number;
};

export type ScreenTimeLeaderboard = {
  weekKey: string;
  groupSize: number;
  me: ScreenTimeEntry | null;
  entries: ScreenTimeEntry[];
  // Saptamana TRECUTA finalizata lazy la acest GET (null daca nu erau date).
  lastWeek: ScreenTimeWeekResult | null;
};

export function getScreenTimeLeaderboard() {
  return api<ScreenTimeLeaderboard>('/screentime/leaderboard');
}

export function reportScreenTime(input: { day?: string; minutes: number; source?: string }) {
  return api<{ day: string; minutes: number }>('/screentime/report', {
    method: 'POST',
    body: input,
  });
}
