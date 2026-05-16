import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  equipDefaultPet,
  equipPetCard,
  getMyPet,
  petImageUrl,
  type PetMeResponse,
  type PetSpeciesDto,
  scanPetCard,
} from '../../src/api/pets';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { colors } from '../../src/theme/colors';

export default function Pets() {
  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['pet'],
    queryFn: getMyPet,
  });
  const [scanning, setScanning] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, []);

  const scan = useMutation({
    mutationFn: (uid: string) => scanPetCard(uid),
    onSuccess: (res) => {
      qc.setQueryData<PetMeResponse | undefined>(['pet'], (prev) => {
        if (!prev) return prev;
        const cards = prev.cards.map((c) => ({ ...c, equipped: c.id === res.card.id }));
        const hasIt = cards.some((c) => c.id === res.card.id);
        return {
          ...prev,
          pet: res.pet,
          cards: hasIt ? cards : [...cards, { ...res.card, equipped: true }],
          defaultEquipped: false,
        };
      });
      void refetch();
      Alert.alert(
        res.newClaim ? 'Card nou!' : 'Echipat',
        res.newClaim
          ? `${res.card.species.name} e acum prietenul tau!`
          : `${res.card.species.name} e activ.`,
      );
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'card_taken'
          ? 'Cardul are deja proprietar.'
          : err instanceof ApiError && err.code === 'card_unknown'
            ? 'Cardul scanat nu e in baza de date.'
            : err?.message ?? 'Nu am putut citi cardul';
      Alert.alert('Eroare', msg);
    },
  });

  const equip = useMutation({
    mutationFn: (cardId: string) => equipPetCard(cardId),
    onSuccess: (res) => {
      qc.setQueryData<PetMeResponse | undefined>(['pet'], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pet: res.pet,
          cards: prev.cards.map((c) => ({ ...c, equipped: c.id === res.card.id })),
          defaultEquipped: false,
        };
      });
      // Backend a sters chat history-ul la /equip — invalidate ca la urmatoarea
      // deschidere a chat-ului sa primim intro-ul noului pet (cu TTS proaspat).
      qc.invalidateQueries({ queryKey: ['pet', 'chat'] });
    },
    onError: (err: any) => {
      Alert.alert('Eroare', err?.message ?? 'Nu am putut echipa cardul');
    },
  });

  const equipDefault = useMutation({
    mutationFn: () => equipDefaultPet(),
    onSuccess: (res) => {
      qc.setQueryData<PetMeResponse | undefined>(['pet'], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pet: res.pet,
          cards: prev.cards.map((c) => ({ ...c, equipped: false })),
          defaultEquipped: true,
        };
      });
      qc.invalidateQueries({ queryKey: ['pet', 'chat'] });
    },
    onError: (err: any) => {
      Alert.alert('Eroare', err?.message ?? 'Nu am putut activa Buddy');
    },
  });

  async function startScan() {
    setScanning(true);
    try {
      const uid = await readTagUid({ alertMessage: 'Apropie cardul de iPhone' });
      scan.mutate(uid);
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine cardul aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanning(false);
    }
  }

  const heroCatchphrase = useMemo(() => {
    const phrases = data?.pet.species.catchphrases ?? [];
    if (phrases.length === 0) return null;
    return phrases[Math.floor(Math.random() * phrases.length)] ?? null;
    // re-pick la fiecare schimbare de specie/nume — vrem replica proaspata
    // cand user-ul revine la ecran sau schimba pet-ul activ.
  }, [data?.pet.species.slug, data?.pet.name]);

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Nu am putut incarca pet-ul.</Text>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Reincearca</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { pet, cards, defaultSpecies, defaultEquipped } = data;
  const heroUri = petImageUrl(pet.species.imagePath);
  const equipPendingFor =
    equip.isPending && typeof equip.variables === 'string' ? equip.variables : null;

  const scanLabel = scan.isPending
    ? 'Se salveaza…'
    : scanning
      ? 'Anuleaza scanarea'
      : nfcAvailable === false && Platform.OS === 'ios'
        ? 'NFC indisponibil iOS'
        : nfcAvailable === false
          ? 'NFC indisponibil'
          : 'Scaneaza card nou';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.headerBtnIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Pet-urile mele</Text>
        <Pressable
          onPress={() => {
            if (scanning) {
              cancelTagRead();
              setScanning(false);
            } else if (nfcAvailable) {
              void startScan();
            } else {
              Alert.alert(
                'NFC indisponibil',
                Platform.OS === 'ios'
                  ? 'NFC pe iOS necesita versiune speciala. Foloseste un Android sau cere unui prieten sa scaneze.'
                  : 'Verifica setarile telefonului ca NFC sa fie pornit.',
              );
            }
          }}
          hitSlop={12}
          style={[styles.headerBtn, styles.headerBtnAccent]}
          disabled={scan.isPending}
        >
          <Text style={[styles.headerBtnIcon, styles.headerBtnIconAccent]}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroImageWrap}>
            {heroUri ? (
              <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="contain" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Text style={styles.heroEmoji}>🐾</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{pet.name}</Text>
          <Text style={styles.heroSpecies}>{pet.species.name}</Text>
          <View style={styles.heroBondRow}>
            <Text style={styles.heroBondStar}>★</Text>
            <Text style={styles.heroBondText}>{pet.bondXp} XP legatura</Text>
          </View>
          {heroCatchphrase && (
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{`„${heroCatchphrase}”`}</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Colectia ta</Text>
          <Text style={styles.sectionCount}>{cards.length + 1}</Text>
        </View>

        <View style={styles.grid}>
          <PetTile
            kind="default"
            species={defaultSpecies}
            name="Buddy"
            active={defaultEquipped}
            pending={equipDefault.isPending}
            onPress={() => {
              if (defaultEquipped || equipDefault.isPending) return;
              equipDefault.mutate();
            }}
          />

          {cards.map((c) => (
            <PetTile
              key={c.id}
              kind="card"
              species={c.species}
              name={c.nickname ?? c.species.name}
              active={c.equipped && !defaultEquipped}
              pending={equipPendingFor === c.id}
              onPress={() => {
                if (c.equipped && !defaultEquipped) return;
                equip.mutate(c.id);
              }}
            />
          ))}

          <ScanTile
            label={scanLabel}
            pending={scan.isPending}
            scanning={scanning}
            disabled={!nfcAvailable && !scanning}
            onPress={() => {
              if (scanning) {
                cancelTagRead();
                setScanning(false);
              } else if (nfcAvailable) {
                void startScan();
              } else {
                Alert.alert(
                  'NFC indisponibil',
                  Platform.OS === 'ios'
                    ? 'NFC pe iOS necesita versiune speciala. Foloseste un Android.'
                    : 'Verifica setarile telefonului ca NFC sa fie pornit.',
                );
              }
            }}
          />
        </View>

        <Text style={styles.hint}>
          Apasa pe un pet ca sa-l activezi. Buddy e mereu cu tine — poti reveni la el oricand.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PetTile({
  kind,
  species,
  name,
  active,
  pending,
  onPress,
}: {
  kind: 'default' | 'card';
  species: PetSpeciesDto;
  name: string;
  active: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const uri = petImageUrl(species.imagePath);
  const isDefault = kind === 'default';
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [
        styles.tile,
        isDefault && styles.tileDefault,
        active && styles.tileActive,
        pressed && !pending && styles.tilePressed,
      ]}
    >
      <View style={styles.tileBadgeRow}>
        {isDefault && (
          <View style={styles.tileBadgeDefault}>
            <Text style={styles.tileBadgeDefaultText}>DEFAULT</Text>
          </View>
        )}
        {active && (
          <View style={styles.tileBadgeActive}>
            <Text style={styles.tileBadgeActiveText}>ACTIV</Text>
          </View>
        )}
      </View>

      <View style={styles.tileImageWrap}>
        {pending ? (
          <ActivityIndicator color={colors.accent} />
        ) : uri ? (
          <Image source={{ uri }} style={styles.tileImage} resizeMode="contain" />
        ) : (
          <Text style={styles.tileEmoji}>🐾</Text>
        )}
      </View>

      <Text style={styles.tileName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.tileSpecies} numberOfLines={1}>
        {species.name}
      </Text>
    </Pressable>
  );
}

function ScanTile({
  label,
  pending,
  scanning,
  disabled,
  onPress,
}: {
  label: string;
  pending: boolean;
  scanning: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [
        styles.tile,
        styles.tileScan,
        disabled && styles.tileScanDisabled,
        pressed && !pending && styles.tilePressed,
      ]}
    >
      <View style={styles.tileBadgeRow}>
        <View style={styles.tileBadgeNew}>
          <Text style={styles.tileBadgeNewText}>+ NEW</Text>
        </View>
      </View>

      <View style={styles.tileImageWrap}>
        {pending || scanning ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.scanPlusBig}>+</Text>
        )}
      </View>

      <Text style={styles.tileName} numberOfLines={1}>
        {scanning ? 'Anuleaza' : 'Scaneaza'}
      </Text>
      <Text style={styles.tileSpecies} numberOfLines={2}>
        {label.includes('indisponibil') ? label : 'card NFC nou'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerBtn: {
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
  headerBtnAccent: { backgroundColor: colors.accent },
  headerBtnIcon: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerBtnIconAccent: { color: '#FFFFFF', fontSize: 26, lineHeight: 28 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },

  scroll: { padding: 20, paddingTop: 8, gap: 18 },

  hero: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 22,
    gap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 5,
  },
  heroImageWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroImage: { width: 180, height: 180 },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 80 },
  heroName: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  heroSpecies: { color: colors.textMuted, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroBondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBondStar: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  heroBondText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  bubble: {
    marginTop: 12,
    backgroundColor: colors.bgAlt,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '95%',
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sectionCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    minHeight: 180,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 12,
    gap: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  tileDefault: {
    borderColor: colors.accent,
    backgroundColor: colors.cardAlt,
  },
  tileActive: {
    borderColor: colors.success,
  },
  tilePressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  tileScan: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tileScanDisabled: { opacity: 0.5 },

  tileBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    minHeight: 22,
    gap: 6,
    justifyContent: 'flex-start',
  },
  tileBadgeDefault: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tileBadgeDefaultText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tileBadgeActive: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tileBadgeActiveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tileBadgeNew: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tileBadgeNewText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  tileImageWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  tileImage: { width: 88, height: 88 },
  tileEmoji: { fontSize: 44 },
  scanPlusBig: {
    color: colors.accent,
    fontSize: 56,
    fontWeight: '300',
    lineHeight: 60,
  },
  tileName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  tileSpecies: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },

  errorText: { color: colors.danger, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.accent, fontWeight: '700' },
});
