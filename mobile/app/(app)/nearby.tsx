import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePresence } from '../../src/ble/usePresence';
import type { Peer } from '../../src/ble/presence';
import { addFriend } from '../../src/api/friends';
import { ApiError } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

export default function Nearby() {
  const qc = useQueryClient();
  const { active, peers, error, advertiseFailed, start, stop } = usePresence();
  const [adding, setAdding] = useState<string | null>(null);

  // Pornim scanarea automat la deschidere; oprim la unmount doar daca am pornit
  // noi (alt ecran — co-walk hunt — poate fi tot pe presence engine).
  useEffect(() => {
    const wasActive = active;
    if (!wasActive) void start();
    return () => {
      if (!wasActive) void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useMutation({
    mutationFn: (userId: string) => addFriend(userId, 'ble'),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
      // Marcam local imediat ca peer-ul e prieten — usePresence il rezolva
      // tot prieten la urmatorul resolve cycle (~15s), pana atunci UI-ul
      // se actualizeaza optimist.
      Alert.alert('Prieten nou', 'Aveti acum un nou prieten!');
      setAdding(null);
    },
    onError: (err: any, userId) => {
      const msg =
        err instanceof ApiError && err.code === 'self_friend'
          ? 'Nu te poti adauga pe tine'
          : err?.message ?? 'Nu am putut adauga prietenul';
      Alert.alert('Hopa', msg);
      setAdding(null);
    },
  });

  function onAdd(peer: Peer) {
    if (!peer.userId) return;
    setAdding(peer.userId);
    add.mutate(peer.userId);
  }

  // Sortare: necunoscuti rezolvati intai (cei care pot fi adaugati), apoi
  // prieteni deja, apoi token-uri inca nerezolvate.
  const sorted = [...peers].sort((a, b) => {
    const score = (p: Peer) => {
      if (p.userId && !p.isFriend) return 0;
      if (p.userId && p.isFriend) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Prieteni in apropiere</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Bluetooth</Text>
        <Text style={[styles.statusValue, { color: active ? colors.accent : colors.textMuted }]}>
          {active ? 'CAUT...' : 'OPRIT'}
        </Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {active && advertiseFailed && (
          <>
            <Text style={styles.warnText}>
              Esti invizibil pentru ceilalti. Verifica daca Bluetooth-ul e pornit si daca aplicatia
              are permisiune.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.settingsBtnText}>Deschide Setari</Text>
            </Pressable>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {sorted.length === 0 ? (
          <View style={styles.emptyBox}>
            {active && <ActivityIndicator color={colors.accent} />}
            <Text style={styles.empty}>
              {active
                ? 'Caut prieteni in apropiere... Tine telefonul aproape de altcineva care are aplicatia deschisa.'
                : 'Bluetooth oprit.'}
            </Text>
          </View>
        ) : (
          sorted.map((peer) => (
            <PeerRow
              key={peer.token}
              peer={peer}
              isAdding={adding === peer.userId}
              onAdd={() => onAdd(peer)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PeerRow({
  peer,
  isAdding,
  onAdd,
}: {
  peer: Peer;
  isAdding: boolean;
  onAdd: () => void;
}) {
  const resolved = !!peer.userId;
  const proximity = peer.rssi >= -65 ? 'Foarte aproape' : peer.rssi >= -75 ? 'Aproape' : 'In raza';

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={1}>
          {peer.name ?? 'Se identifica...'}
        </Text>
        <View style={styles.rowMeta}>
          {peer.level !== undefined && (
            <Text style={styles.metaItem}>Lvl {peer.level}</Text>
          )}
          <Text style={styles.metaItem}>{proximity}</Text>
        </View>
      </View>

      {peer.isFriend ? (
        <View style={[styles.actionBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.actionBadgeText}>PRIETEN</Text>
        </View>
      ) : resolved ? (
        <Pressable
          onPress={onAdd}
          disabled={isAdding}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.85 },
            isAdding && { opacity: 0.6 },
          ]}
        >
          {isAdding ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.addBtnText}>Adauga</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.metaItem}>...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.accent, fontSize: 24, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },

  statusCard: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusValue: { fontSize: 18, fontWeight: '800' },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '700', marginTop: 8 },
  warnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 16,
  },
  settingsBtn: {
    marginTop: 10,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  settingsBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10 },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', gap: 12 },
  metaItem: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 90,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
