import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ensureMicPermission,
  playPetVoice,
  speakDevice,
  stopDevice,
  stopRemoteAudio,
} from '../../src/lib/speech';
import { absoluteAudioUrl, ttsSynthesize } from '../../src/api/stories';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

const INTRO_TEXT =
  'Salut! Eu sunt Buddy, prietenul tau virtual! Hai sa cream povesti impreuna si sa ne distram!';

export default function PetIntro() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(INTRO_TEXT);
        if (cancelled) return;
        await playPetVoice(INTRO_TEXT, absoluteAudioUrl(audioUrl));
      } catch {
        if (cancelled) return;
        speakDevice(INTRO_TEXT);
      }
    })();
    return () => {
      cancelled = true;
      stopDevice();
      void stopRemoteAudio();
    };
  }, []);

  async function askPermission() {
    const ok = await ensureMicPermission();
    setGranted(ok);
  }

  function continueOn() {
    stopDevice();
    router.replace('/(app)/avatar-edit?firstTime=1');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.heroBox}>
          <Text style={styles.bigEmoji}>🐶</Text>
          <Text style={styles.bigName}>Buddy</Text>
        </View>

        <Text style={styles.title}>Salut! Eu sunt Buddy</Text>
        <Text style={styles.subtitle}>
          Prietenul tau virtual. O sa cream povesti impreuna, o sa ne jucam si o sa
          povestesti prietenilor tai!
        </Text>

        {granted === null ? (
          <View style={styles.permBlock}>
            <Text style={styles.permTitle}>Buddy te poate auzi</Text>
            <Text style={styles.permText}>
              Daca vrei, poti sa-i vorbesti in loc sa scrii. Apasam butonul ca sa-i
              dam voie?
            </Text>
            <Button label="Da, asculta-ma!" onPress={askPermission} />
            <Pressable onPress={continueOn} hitSlop={12}>
              <Text style={styles.skip}>Mai tarziu</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.permBlock}>
            <Text style={styles.permTitle}>
              {granted ? 'Super, te aud!' : 'Nu-i nimic, putem si in scris.'}
            </Text>
            <Text style={styles.permText}>
              {granted
                ? 'Acum hai sa-ti facem si tie un avatar tare.'
                : 'Poti schimba din Setari mai tarziu daca vrei sa-i vorbesti.'}
            </Text>
            <Button label="Hai mai departe!" onPress={continueOn} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 16 },
  heroBox: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
    gap: 8,
  },
  bigEmoji: { fontSize: 110 },
  bigName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    opacity: 0.75,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  permBlock: {
    marginTop: 'auto',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  permTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  permText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  skip: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
