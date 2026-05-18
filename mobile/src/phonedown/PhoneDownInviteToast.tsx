import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { usePhoneDownInvites } from './usePhoneDownInvites';
import { joinSession } from '../api/phonedown';
import { ApiError } from '../api/client';
import { colors } from '../theme/colors';

// Toast global pentru invitatii Phone Down. Apare overlay deasupra tuturor
// ecranelor, deasupra altor toast-uri (zIndex mai mare decat CoWalkToast).
// User-ul poate sa-l ignore (auto-dismiss in 12s) sau sa intre direct in lobby.
export function PhoneDownInviteToast() {
  const qc = useQueryClient();
  const { invite, dismiss } = usePhoneDownInvites();
  const slide = useRef(new Animated.Value(-120)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!invite) return;
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    dismissTimer.current = setTimeout(() => handleDismiss(), 12_000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  function handleDismiss() {
    Animated.timing(slide, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => dismiss());
  }

  async function handleJoin() {
    if (!invite || joining) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    const id = invite.sessionId;
    setJoining(true);
    try {
      // Server adauga user-ul ca PhoneDownParticipant. Idempotent — daca
      // user-ul a apasat deja, returneaza state-ul curent fara eroare.
      const session = await joinSession(id);
      qc.setQueryData(['phonedown', 'session', id], session);
      qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
      dismiss();
      router.push({ pathname: '/(app)/phonedown', params: { sessionId: id } });
    } catch (e) {
      setJoining(false);
      const msg =
        e instanceof ApiError
          ? e.code === 'lobby_closed'
            ? 'Lobby-ul nu mai e disponibil — host-ul a pornit deja runda sau a iesit.'
            : e.code === 'already_in_session'
              ? 'Esti deja intr-o sesiune Phone Down. Iesi din ea intai.'
              : e.message
          : 'Nu pot intra in lobby acum.';
      Alert.alert('Nu pot intra', msg);
    }
  }

  if (!invite) return null;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <Animated.View
        style={[styles.toast, { transform: [{ translateY: slide }] }]}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText}>📵</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.hostName} te-a invitat
          </Text>
          <Text style={styles.subtitle}>Phone Down — cine sta mai mult fara telefon</Text>
        </View>
        <Pressable
          onPress={handleJoin}
          disabled={joining}
          style={({ pressed }) => [
            styles.joinBtn,
            (pressed || joining) && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.joinBtnText}>{joining ? '...' : 'Intra'}</Text>
        </Pressable>
        <Pressable onPress={handleDismiss} hitSlop={10} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>×</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10001,
  },
  toast: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#2D2A4A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  content: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '700' },
});
