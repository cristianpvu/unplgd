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
import Svg, { Path } from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presence, type Peer } from '../../src/ble/presence';
import { usePresence } from '../../src/ble/usePresence';
import { requestBlePermissions } from '../../src/ble/permissions';
import { getCowalkEnabledCached } from '../../src/ble/cowalkPref';
import { addFriend } from '../../src/api/friends';
import { ApiError } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

// Hub "adauga prieten". Auto-porneste scan-ul BLE la mount (independent de
// preferinta de co-walk — user-ul a deschis explicit pagina ca sa caute, deci
// vrem scanarea acum). Daca user-ul are co-walk-ul OPRIT din preferinte, la
// iesire oprim engine-ul ca sa-i respectam alegerea de "off"; daca era
// pornit, il lasam asa.

export default function AddFriend() {
  const qc = useQueryClient();
  const { peers, active, advertiseFailed } = usePresence();
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (presence.isRunning()) return;
      const perm = await requestBlePermissions();
      if (cancelled || perm !== 'granted') return;
      try {
        // Daca user-ul are co-walk-ul OFF, pornim doar SCAN — fara advertise
        // si fara heartbeat. Altfel iPhone-ul s-ar face vizibil pe Android-ul
        // unui prieten si backend-ul ar deschide sesiune co-walk fantoma chiar
        // daca user-ul a ales explicit sa fie invizibil.
        const cowalkOn = getCowalkEnabledCached();
        await presence.start({ mode: cowalkOn ? 'full' : 'scan-only' });
      } catch {
        // engine-ul gestioneaza propriile log-uri
      }
    })();
    return () => {
      cancelled = true;
      // Daca user-ul are co-walk-ul oprit, oprim engine-ul cand iesim.
      // Daca-l avea pornit, lasam sa continue (a fost si inainte sa intram).
      if (!getCowalkEnabledCached()) void presence.stop();
    };
  }, []);

  const add = useMutation({
    mutationFn: (userId: string) => addFriend(userId, 'ble'),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
      presence.markPeerAsFriend(userId);
      Alert.alert('Prieten nou', 'Aveti acum un nou prieten!');
      setAdding(null);
    },
    onError: (err: any) => {
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

  // Aratam doar peer-i care nu sunt deja prieteni (ce mai e de adaugat).
  // Peer-i fara userId = inca nerezolvati de backend (apar dupa ~15s) →
  // ii ascundem pana stim cine sunt.
  const candidates = peers.filter((p) => p.userId && !p.isFriend);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Adauga prieten</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Pressable
          onPress={() => router.push('/(app)/scan-friend')}
          style={({ pressed }) => [styles.nfcCta, pressed && styles.nfcCtaPressed]}
        >
          <View style={styles.nfcIconWrap}>
            <NfcIcon />
          </View>
          <View style={styles.nfcBody}>
            <Text style={styles.nfcTitle}>Scaneaza bratara (NFC)</Text>
            <Text style={styles.nfcSub}>
              Apropie telefonul de bratara prietenului ca sa-l adaugi instant
            </Text>
          </View>
          <Text style={styles.nfcChevron}>›</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Prieteni in apropiere (Bluetooth)</Text>

        {advertiseFailed && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Esti invizibil pentru ceilalti. Verifica ca Bluetooth-ul e pornit si ca aplicatia
              are permisiune.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.settingsBtnText}>Deschide Setari</Text>
            </Pressable>
          </View>
        )}

        {candidates.length === 0 ? (
          <View style={styles.emptyBox}>
            {active && <ActivityIndicator color={colors.accent} />}
            <Text style={styles.empty}>
              {active
                ? 'Caut prieteni in apropiere... Tine telefonul aproape de cineva care are aplicatia deschisa.'
                : 'Bluetooth oprit. Verifica permisiunile.'}
            </Text>
          </View>
        ) : (
          candidates.map((peer) => (
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
  const proximity = peer.rssi >= -65 ? 'Foarte aproape' : peer.rssi >= -75 ? 'Aproape' : 'In raza';
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={1}>
          {peer.name ?? 'Se identifica...'}
        </Text>
        <View style={styles.rowMeta}>
          {peer.level !== undefined && <Text style={styles.metaItem}>Lvl {peer.level}</Text>}
          <Text style={styles.metaItem}>{proximity}</Text>
        </View>
      </View>
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
    </View>
  );
}

// Lucide-style "broadcast" icon (sursa: lucide/Vector.svg)
function NfcIcon() {
  return (
    <Svg width={28} height={22} viewBox="0 0 23 18" fill="none">
      <Path
        d="M12 5.22014C12.6392 6.34128 12.9754 7.60958 12.9754 8.90014C12.9754 10.1907 12.6392 11.459 12 12.5801M15.46 3.11003C16.459 4.87622 16.9841 6.87086 16.9841 8.90003C16.9841 10.9292 16.459 12.9238 15.46 14.69M18.9102 1.00017C20.2877 3.4048 21.0133 6.12756 21.0151 8.89884C21.0168 11.6701 20.2947 14.3938 18.9202 16.8002M2 2.90007H7C7.55228 2.90007 8 3.34779 8 3.90007V13.9001C8 14.4524 7.55228 14.9001 7 14.9001H2C1.44772 14.9001 1 14.4524 1 13.9001V3.90007C1 3.34779 1.44772 2.90007 2 2.90007Z"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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

  scrollBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingTop: 10,
    paddingBottom: 4,
  },

  nfcCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accentDim,
  },
  nfcCtaPressed: { opacity: 0.85 },
  nfcIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  nfcBody: { flex: 1, gap: 2 },
  nfcTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  nfcSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  nfcChevron: { color: colors.accent, fontSize: 24, fontWeight: '800' },

  warnBox: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 8,
  },
  warnText: { color: colors.danger, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  settingsBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  settingsBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

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
});
