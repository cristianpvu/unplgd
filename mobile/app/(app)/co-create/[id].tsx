import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelCoCreation,
  getCoCreation,
  submitCoCreation,
  type CoCreation,
} from '../../../src/api/coCreations';
import { ApiError } from '../../../src/api/client';
import { queryClient } from '../../../src/lib/queryClient';
import { Button } from '../../../src/ui/Button';
import { colors } from '../../../src/theme/colors';

export default function CoCreationSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const session = useQuery({
    queryKey: ['co-creations', id],
    queryFn: () => getCoCreation(id!),
    enabled: !!id,
    // Polling activ doar in PROCESSING. Restul starilor sunt terminale (COMPLETED,
    // REJECTED, EXPIRED, FAILED) sau nu se schimba singure (ACTIVE).
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'PROCESSING' ? 2000 : false;
    },
  });

  if (!id) return null;

  if (session.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (session.error || !session.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {session.error instanceof ApiError ? session.error.message : 'Eroare necunoscuta'}
          </Text>
          <Button label="Inapoi" onPress={() => router.replace('/(app)/co-create')} />
        </View>
      </SafeAreaView>
    );
  }

  const c = session.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() =>
            c.status === 'ACTIVE'
              ? Alert.alert('Renunti?', 'Sesiunea va expira.', [
                  { text: 'Continui', style: 'cancel' },
                  {
                    text: 'Da, anuleaza',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await cancelCoCreation(id);
                      } catch {}
                      qc.invalidateQueries({ queryKey: ['co-creations'] });
                      router.replace('/(app)/co-create');
                    },
                  },
                ])
              : router.replace('/(app)/co-create')
          }
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Co-creatie</Text>
        <View style={{ width: 44 }} />
      </View>

      {c.status === 'ACTIVE' && <ActiveView session={c} />}
      {c.status === 'PROCESSING' && <ProcessingView />}
      {c.status === 'COMPLETED' && <CompletedView session={c} />}
      {(c.status === 'REJECTED' || c.status === 'FAILED') && <FailedView session={c} />}
      {c.status === 'EXPIRED' && <ExpiredView />}
    </SafeAreaView>
  );
}

function ActiveView({ session }: { session: CoCreation }) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);

  const submit = useMutation({
    mutationFn: ({ image, mimeType }: { image: string; mimeType: 'image/jpeg' | 'image/png' }) =>
      submitCoCreation(session.id, image, mimeType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['co-creations', session.id] });
    },
    onError: (err: any) => {
      Alert.alert(
        'Trimitere esuata',
        err instanceof ApiError ? err.message : 'Reincearca.',
      );
    },
  });

  async function pickAndSubmit(source: 'camera' | 'library') {
    setPicking(true);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permisiuni', 'Avem nevoie de permisiunea sa accesam camera/galeria.');
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert('Eroare', 'Nu am putut citi poza.');
        return;
      }
      const mime: 'image/jpeg' | 'image/png' =
        asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      submit.mutate({ image: asset.base64, mimeType: mime });
    } finally {
      setPicking(false);
    }
  }

  const otherName = session.participants.find((p) => p.id !== getMyId())?.name ?? '...';
  const expiresIn = Math.max(0, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 60000));

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>cu {otherName}</Text>
        <Text style={styles.bannerTimer}>{expiresIn} min</Text>
      </View>

      <View style={styles.storyBox}>
        <Text style={styles.storyTitle}>{session.story.title}</Text>
        <Text style={styles.storyBody}>{session.story.body}</Text>
      </View>

      <View style={styles.instrBox}>
        <Text style={styles.instrTitle}>📝 Cum se joaca</Text>
        <Text style={styles.instrText}>
          1. Cititi povestea impreuna{'\n'}
          2. Desenati pe hartie scena voastra preferata{'\n'}
          3. Faceti o poza desenului si trimiteti-o{'\n'}
          4. AI-ul transforma desenul intr-o ilustratie magica
        </Text>
      </View>

      <Button
        label={submit.isPending ? 'Trimit poza...' : 'Fa poza desenului'}
        onPress={() => pickAndSubmit('camera')}
        loading={submit.isPending || picking}
        disabled={submit.isPending || picking}
      />
      <Button
        label="Sau alege din galerie"
        variant="secondary"
        onPress={() => pickAndSubmit('library')}
        disabled={submit.isPending || picking}
      />
    </ScrollView>
  );
}

function ProcessingView() {
  return (
    <View style={styles.center}>
      <Text style={styles.bigIcon}>✨</Text>
      <Text style={styles.processingTitle}>AI-ul lucreaza la magia voastra</Text>
      <Text style={styles.processingSub}>Asta poate dura 5-15 secunde...</Text>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} size="large" />
    </View>
  );
}

function CompletedView({ session }: { session: CoCreation }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.completedHeader}>🎉 Gata!</Text>
      <Text style={styles.completedSub}>
        +80 XP pentru fiecare. Albumul vostru a crescut!
      </Text>

      <View style={styles.imagePair}>
        <View style={styles.imageBox}>
          <Text style={styles.imageLabel}>Desenul vostru</Text>
          {session.originalImageUrl ? (
            <Image source={{ uri: session.originalImageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </View>
        <View style={styles.imageBox}>
          <Text style={styles.imageLabel}>Magia AI</Text>
          {session.aiImageUrl ? (
            <Image source={{ uri: session.aiImageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </View>
      </View>

      <View style={styles.storyBox}>
        <Text style={styles.storyAuthorMeta}>POVESTEA</Text>
        <Text style={styles.storyTitle}>{session.story.title}</Text>
      </View>

      {session.aiFeedback && (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{session.aiFeedback}</Text>
        </View>
      )}

      <Button label="Vezi albumul" onPress={() => router.replace('/(app)/co-create/album')} />
      <Button label="Inapoi acasa" variant="secondary" onPress={() => router.replace('/(app)/')} />
    </ScrollView>
  );
}

function FailedView({ session }: { session: CoCreation }) {
  const isRejected = session.status === 'REJECTED';
  return (
    <View style={styles.center}>
      <Text style={styles.bigIcon}>{isRejected ? '🤔' : '😬'}</Text>
      <Text style={styles.failTitle}>
        {isRejected ? 'Hmm, nu prea s-a potrivit' : 'Ceva n-a mers'}
      </Text>
      {session.aiFeedback && (
        <Text style={styles.failSub}>{session.aiFeedback}</Text>
      )}
      <Button
        label="Incearca alta sesiune"
        onPress={() => router.replace('/(app)/co-create/start')}
        style={{ marginTop: 24 } as any}
      />
      <Button
        label="Inapoi acasa"
        variant="secondary"
        onPress={() => router.replace('/(app)/')}
      />
    </View>
  );
}

function ExpiredView() {
  return (
    <View style={styles.center}>
      <Text style={styles.bigIcon}>⏰</Text>
      <Text style={styles.failTitle}>Sesiunea a expirat</Text>
      <Text style={styles.failSub}>Aveati 30 de minute. Porneste una noua cand sunteti gata.</Text>
      <Button
        label="Sesiune noua"
        onPress={() => router.replace('/(app)/co-create/start')}
        style={{ marginTop: 24 } as any}
      />
    </View>
  );
}

// Id-ul user-ului curent — refolosim cache-ul TanStack Query pe ['me']
// in loc de un alt request.
function getMyId(): string {
  const me = queryClient.getQueryData(['me']) as { id: string } | undefined;
  return me?.id ?? '';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bannerLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  bannerTimer: { color: colors.accent, fontSize: 14, fontWeight: '800' },

  storyBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  storyAuthorMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  storyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  storyBody: { color: colors.text, fontSize: 14, lineHeight: 22 },

  instrBox: {
    backgroundColor: colors.bgAlt,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  instrTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  instrText: { color: colors.text, fontSize: 13, lineHeight: 22 },

  bigIcon: { fontSize: 80, marginBottom: 4 },
  processingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  processingSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  completedHeader: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  completedSub: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  imagePair: { flexDirection: 'row', gap: 10 },
  imageBox: { flex: 1, gap: 6 },
  imageLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
  },
  imagePlaceholder: { backgroundColor: colors.border },

  feedbackBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    padding: 12,
  },
  feedbackText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    fontWeight: '500',
  },

  failTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  failSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  errorText: { color: colors.danger, fontWeight: '600' },
});
