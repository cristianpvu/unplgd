import { api } from './client';

export type NotificationKind = 'park_hint' | string;

export type NotificationItem = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export function getMyNotifications(opts: { unreadOnly?: boolean } = {}) {
  const qs = opts.unreadOnly ? '?unreadOnly=1' : '';
  return api<NotificationsResponse>(`/me/notifications${qs}`);
}

export function markNotificationRead(id: string) {
  return api<{ ok: true; alreadyRead: boolean }>(`/me/notifications/${id}/read`, {
    method: 'POST',
  });
}

export function markAllNotificationsRead() {
  return api<{ ok: true; updated: number }>(`/me/notifications/read-all`, {
    method: 'POST',
  });
}
