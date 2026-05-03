import { useEffect, useState } from 'react';
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
  equipPetCard,
  getMyPet,
  petImageUrl,
  scanPetCard,
  type PetCardDto,
  type PetMeResponse,
} from '../../src/api/pets';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { Button } from '../../src/ui/Button';
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
        // Inlocuim cardul echipat anterior si inseram cel nou-claim-uit daca lipseste.
        const cards = prev.cards.map((c) => ({ ...c, equipped: c.id === res.card.id }));
        const hasIt = cards.some((c) => c.id === res.card.id);
        return {
          pet: res.pet,
          cards: hasIt ? cards : [...cards, { ...res.card, equipped: true }],
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
          pet: res.pet,
          cards: prev.cards.map((c) => ({ ...c, equipped: c.id === res.card.id })),
        };
      });
    },
    onError: (err: any) => {
      Alert.alert('Eroare', err?.message ?? 'Nu am putut echipa cardul');
    },
  });

  async function startScan() {
    setScanning(true);
    try {
      const uid = await readTagUid();
      scan.mutate(uid);
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine cardul aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanning(false);
    }
  }

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

  const { pet, cards } = data;
  const heroUri = petImageUrl(pet.species.imagePath);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Pet-ul meu</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroEmoji}>🐾</Text>
            </View>
          )}
          <Text style={styles.heroName}>{pet.name}</Text>
          <Text style={styles.heroSpecies}>{pet.species.name}</Text>
          {pet.species.shortLore.length > 0 && (
            <Text style={styles.heroLore}>{pet.species.shortLore}</Text>
          )}
          <Text style={styles.bond}>Legatura: {pet.bondXp} XP</Text>
        </View>

        <Text style={styles.sectionTitle}>Cardurile mele</Text>
        {cards.length === 0 ? (
          <Text style={styles.empty}>
            Inca nu ai carduri. Scaneaza primul card ca sa colectionezi prieteni noi.
          </Text>
        ) : (
          <View style={styles.cardList}>
            {cards.map((c) => (
              <CardRow
                key={c.id}
                card={c}
                onPress={() => {
                  if (c.equipped) return;
                  equip.mutate(c.id);
                }}
                pending={equip.isPending && equip.variables === c.id}
              />
            ))}
          </View>
        )}

        <View style={styles.scanBlock}>
          <Text style={styles.scanHint}>
            {nfcAvailable
              ? 'Apropie un card NFC de spatele telefonului ca sa-l scanezi.'
              : Platform.OS === 'ios'
                ? 'NFC indisponibil pe iOS in versiunea curenta. Foloseste un Android.'
                : 'NFC indisponibil. Verifica setarile telefonului.'}
          </Text>
          <Button
            label={
              scan.isPending
                ? 'Se salveaza…'
                : scanning
                  ? 'Anuleaza scanarea'
                  : 'Scaneaza card nou'
            }
            onPress={() => {
              if (scanning) {
                cancelTagRead();
                setScanning(false);
              } else {
                void startScan();
              }
            }}
            disabled={!nfcAvailable || scan.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CardRow({
  card,
  onPress,
  pending,
}: {
  card: PetCardDto;
  onPress: () => void;
  pending: boolean;
}) {
  const uri = petImageUrl(card.species.imagePath);
  const displayName = card.nickname ?? card.species.name;
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [
        styles.cardRow,
        card.equipped && styles.cardRowEquipped,
        pressed && styles.cardRowPressed,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.cardImage} resizeMode="contain" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.cardImageEmoji}>🐾</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{displayName}</Text>
        <Text style={styles.cardSpecies}>{card.species.name}</Text>
      </View>
      {pending ? (
        <ActivityIndicator color={colors.accent} />
      ) : card.equipped ? (
        <Text style={styles.equippedBadge}>Activ</Text>
      ) : (
        <Text style={styles.cardChevron}>›</Text>
      )}
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

  scroll: { padding: 20, gap: 18 },

  hero: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroImage: { width: 180, height: 180 },
  heroPlaceholder: {
    backgroundColor: colors.cardAlt,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 64 },
  heroName: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
  heroSpecies: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  heroLore: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.85,
  },
  bond: { color: colors.accent, fontSize: 13, fontWeight: '800', marginTop: 6 },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
  },
  cardList: { gap: 8 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardRowEquipped: { borderColor: colors.accent },
  cardRowPressed: { opacity: 0.6 },
  cardImage: { width: 48, height: 48 },
  cardImagePlaceholder: {
    backgroundColor: colors.cardAlt,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageEmoji: { fontSize: 24 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardSpecies: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  equippedBadge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardChevron: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },

  scanBlock: { gap: 10, marginTop: 6 },
  scanHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },

  errorText: { color: colors.danger, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.accent, fontWeight: '700' },
});
