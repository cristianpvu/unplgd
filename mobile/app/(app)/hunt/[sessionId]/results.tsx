import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { createAudioPlayer } from 'expo-audio';
import { getResults } from '../../../../src/api/hunt';
import { colors } from '../../../../src/theme/colors';

const RANK_COLOR: Record<number, string> = {
  1: '#F1C40F',
  2: '#BDC3C7',
  3: '#CD7F32',
};

export default function HuntResults() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const qc = useQueryClient();

  const resultsQuery = useQuery({
    queryKey: ['hunt', 'results', sessionId],
    queryFn: () => getResults(sessionId),
    enabled: !!sessionId,
  });

  const teams = resultsQuery.data?.teams ?? [];
  const fadeAnims = useRef(teams.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!teams.length) return;
    Animated.stagger(
      80,
      teams.map((_, i) =>
        Animated.timing(fadeAnims[i] ?? new Animated.Value(0), {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [teams.length]);

  // Theme song la podium — melodia pet-ului leader-ului echipei rank=1.
  // Pornit cu delay sa coincida cu aterizarea treaptei 1 (stepDelay 600ms +
  // spring settle). Cleanup la unmount sau cand userul iese din ecran.
  const winnerSoundUrl =
    teams.find((t) => t.rank === 1)?.leaderPetSoundUrl ?? null;
  // `confettiActive` se flip-eaza pe true exact in momentul in care apasam
  // player.play() — confetti si melodia pornesc sincronizate, fara delay vizibil.
  const [confettiActive, setConfettiActive] = useState(false);
  useEffect(() => {
    if (!winnerSoundUrl) return;
    let cancelled = false;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        player = createAudioPlayer({ uri: winnerSoundUrl });
        player.play();
        setConfettiActive(true);
      } catch {
        // ignore — sound e bonus, nu blocheaza UX
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setConfettiActive(false);
      try {
        player?.pause();
        player?.remove();
      } catch {
        // ignore
      }
    };
  }, [winnerSoundUrl]);

  if (!sessionId || resultsQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (resultsQuery.error || !resultsQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={styles.error}>Nu am putut incarca rezultatele</Text>
      </SafeAreaView>
    );
  }

  const data = resultsQuery.data;
  const myRank = data.myXp?.rank ?? null;
  const isWinner = myRank === 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Tag mic + titlu mare in stanga */}
        <View style={styles.header}>
          <Text style={[styles.tag, isWinner && { color: RANK_COLOR[1] }]}>
            {isWinner ? 'CAMPION' : 'TERMINAT'}
          </Text>
          <Text style={styles.title}>
            {isWinner ? 'Felicitari!' : 'Vanatoarea s-a terminat'}
          </Text>
          {myRank && (
            <Text style={styles.sub}>
              Ai terminat pe locul {myRank}
              {isWinner ? '!' : ''}
            </Text>
          )}
        </View>

        {/* Podium fizic — 3 trepte cu avatarele echipelor pe ele */}
        {data.teams.length > 0 && (
          <View style={styles.podiumStage}>
            <Confetti active={confettiActive} />
            <Champagne active={confettiActive} />
            <Podium teams={data.teams} myTeamRank={myRank} />
          </View>
        )}

        {/* XP card cu count-up */}
        {data.myXp && <MyXpCard amount={data.myXp.amount} rank={data.myXp.rank} />}

        {/* Lista echipe — minimalist, rank colorat pe podium */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Clasament</Text>
          {data.teams.map((team, idx) => {
            const fade = fadeAnims[idx] ?? new Animated.Value(1);
            const rankColor = RANK_COLOR[team.rank];
            return (
              <Animated.View
                key={team.id}
                style={[
                  styles.teamRow,
                  {
                    opacity: fade,
                    transform: [
                      {
                        translateY: fade.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    rankColor ? { backgroundColor: rankColor } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankBadgeText,
                      rankColor ? { color: '#FFFFFF' } : null,
                    ]}
                  >
                    {team.rank}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                  <View style={styles.membersStack}>
                    {team.members.slice(0, 6).map((m, i) => (
                      <View
                        key={m.id}
                        style={[styles.memberAvatar, { marginLeft: i === 0 ? 0 : -8 }]}
                      >
                        {m.avatarSvg ? (
                          <SvgXml xml={m.avatarSvg} width={22} height={22} />
                        ) : (
                          <View style={styles.avatarFallback} />
                        )}
                      </View>
                    ))}
                    <Text style={styles.teamMeta}>
                      {team.monstersDefeated}{' '}
                      {team.monstersDefeated === 1 ? 'monstru' : 'monstri'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.teamScore}>{team.score}</Text>
              </Animated.View>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            qc.invalidateQueries({ queryKey: ['me'] });
            router.replace('/(app)/');
          }}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.doneText}>Inchide</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Podium fizic — 3 trepte cu inaltimi diferite, in ordinea vizuala 2-1-3.
// Pe fiecare treapta randam un cluster de avatare ale membrilor echipei + numele
// echipei + scorul. Treptele intra in scena cu spring stagger de jos in sus
// (3 → 2 → 1), apoi avatarele pop-in dupa.
type PodiumTeam = {
  id: string;
  rank: number;
  name: string;
  score: number;
  members: { id: string; name: string; avatarSvg: string | null; petImageUrl: string | null }[];
};

function Podium({ teams, myTeamRank }: { teams: PodiumTeam[]; myTeamRank: number | null }) {
  // Ordoneaza vizual: 2nd stanga, 1st centru, 3rd dreapta. Daca lipseste o
  // pozitie (mai putin de 3 echipe), o sarim.
  const podiumOrder = ([2, 1, 3] as const)
    .map((r) => teams.find((t) => t.rank === r))
    .filter((t): t is PodiumTeam => !!t);

  return (
    <View style={styles.podiumWrap}>
      {podiumOrder.map((team) => (
        <PodiumStep key={team.id} team={team} mine={myTeamRank === team.rank} />
      ))}
    </View>
  );
}

function PodiumStep({ team, mine }: { team: PodiumTeam; mine: boolean }) {
  // Spring entrance: treptele se urca 3 → 2 → 1. Caracterele intra dupa step.
  const step = useRef(new Animated.Value(0)).current;
  const chars = useRef(new Animated.Value(0)).current;

  const stepDelay = (4 - team.rank) * 200;
  const charsDelay = stepDelay + 350;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(stepDelay),
      Animated.spring(step, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(charsDelay),
      Animated.spring(chars, { toValue: 1, friction: 6, tension: 110, useNativeDriver: true }),
    ]).start();
  }, [step, chars, stepDelay, charsDelay]);

  // Inaltimi trepte clasice + dimensiuni caracter + coronita scalate cu rank-ul.
  const heights: Record<number, number> = { 1: 110, 2: 78, 3: 52 };
  const charSizes: Record<number, { char: number; pet: number; crown: number }> = {
    1: { char: 92, pet: 40, crown: 28 },
    2: { char: 78, pet: 34, crown: 22 },
    3: { char: 70, pet: 30, crown: 20 },
  };
  const stepH = heights[team.rank] ?? 40;
  const sz = charSizes[team.rank] ?? { char: 64, pet: 28, crown: 18 };
  const color = RANK_COLOR[team.rank] ?? colors.cardAlt;

  // Coronita SVG colorata per rank — fiecare caracter de pe podium poarta una.
  const crownSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 28">
    <path d="M4 22 L4 10 L12 16 L20 4 L28 16 L36 10 L36 22 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
    <circle cx="4" cy="8" r="2.5" fill="${color}"/>
    <circle cx="20" cy="2" r="2.5" fill="${color}"/>
    <circle cx="36" cy="8" r="2.5" fill="${color}"/>
  </svg>`;

  const stepTranslateY = step.interpolate({
    inputRange: [0, 1],
    outputRange: [stepH + 30, 0],
  });
  const charsTranslateY = chars.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const charsScale = chars.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  // DiceBear-style avatare au viewBox patrat (head only la 762x762 sau full body
  // compus la 762x1400). Render in container portrait (1:1.4) — daca SVG-ul e
  // full body apare integral, daca e head only apare centrat sus.
  const charW = sz.char;
  const charH = Math.round(sz.char * 1.45);

  // Cu cat sunt mai multi membri intr-o echipa, cu atat caracterele se
  // imbratiseaza mai dens ca sa intre in latimea coloanei (overlap inteligent).
  // 1-2 membri: gap mic; 3+: caracterele se suprapun partial.
  const memberCount = team.members.length;
  const memberOverlap =
    memberCount <= 1 ? 0 : memberCount === 2 ? -Math.round(charW * 0.18) : -Math.round(charW * 0.32);

  return (
    <View style={styles.podiumCol}>
      {/* Nume echipa + scor DEASUPRA caracterelor — astfel caracterele raman
          cu talpile direct pe treapta, sa para ca chiar stau pe podium. */}
      <Animated.View
        style={[
          styles.podiumLabel,
          {
            opacity: chars,
            transform: [{ translateY: charsTranslateY }, { scale: charsScale }],
          },
        ]}
      >
        <Text style={[styles.podiumTeamName, mine && styles.podiumTeamNameMine]} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.podiumScore}>{team.score}</Text>
      </Animated.View>

      {/* Caractere full body langa langa, talpile aliniate la baza coloanei
          (podiumChars are paddingBottom 0). */}
      <Animated.View
        style={[
          styles.podiumChars,
          {
            opacity: chars,
            transform: [{ translateY: charsTranslateY }, { scale: charsScale }],
          },
        ]}
      >
        <View style={styles.podiumLineup}>
          {team.members.map((m, idx) => (
            <PodiumMember
              key={m.id}
              member={m}
              idx={idx}
              memberCount={team.members.length}
              memberOverlap={memberOverlap}
              charW={charW}
              charH={charH}
              petSize={sz.pet}
              crownSize={sz.crown}
              crownSvg={crownSvg}
              // Bounce-ul de fericire suna numai la rank 1 — restul stau cuminte.
              bouncing={team.rank === 1}
              bounceDelay={charsDelay + 500 + idx * 120}
            />
          ))}
        </View>
      </Animated.View>

      {/* Treapta — wrapper cu overflow:hidden si height fix permite intrarea
          spring de jos fara sa clip-uim si crown-urile sau pet-urile peek out
          care stau in alta zona a layout-ului. */}
      <View style={{ width: '100%', height: stepH, overflow: 'hidden' }}>
        <Animated.View
          style={[
            styles.podiumBlock,
            {
              height: stepH,
              backgroundColor: color,
              transform: [{ translateY: stepTranslateY }],
            },
          ]}
        >
          <Text style={styles.podiumRank}>{team.rank}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// Un singur membru pe podium — extras ca sa poata avea propriul Animated.Value
// pt bounce (nu putem chema hooks intr-un .map). Pe rank 1, avatarul si pet-ul
// "topaie" subtle si asincron, ca si cum se bucura. Pe restul rank-urilor stau
// statici.
//
// Async-ul vine din 2 surse:
//   1. perioadele diferite intre avatar (~900ms) si pet (~720ms) — niciodata
//      nu cad pe acelasi ritm.
//   2. delay-uri de pornire offset per index — al doilea membru porneste cu
//      120ms intarziere fata de primul.
type PodiumMemberData = {
  id: string;
  name: string;
  avatarSvg: string | null;
  petImageUrl: string | null;
};

function PodiumMember({
  member,
  idx,
  memberCount,
  memberOverlap,
  charW,
  charH,
  petSize,
  crownSize,
  crownSvg,
  bouncing,
  bounceDelay,
}: {
  member: PodiumMemberData;
  idx: number;
  memberCount: number;
  memberOverlap: number;
  charW: number;
  charH: number;
  petSize: number;
  crownSize: number;
  crownSvg: string;
  bouncing: boolean;
  bounceDelay: number;
}) {
  const avatarHop = useRef(new Animated.Value(0)).current;
  const petHop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bouncing) return;
    // Avatar: hop usor de ~5px, perioada ~900ms. Easing sinusoidal-ish da
    // un "boop" curat fara senzatie agresiva.
    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarHop, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(avatarHop, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    // Pet: amplitudine mai mare (e mai mic, are nevoie de "punch"), perioada
    // mai scurta ~720ms ca sa fie complet desincronizat fata de avatar.
    const petLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(petHop, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(petHop, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const startAvatar = setTimeout(() => avatarLoop.start(), bounceDelay);
    // Pet porneste cu un offset suplimentar — niciodata la pas cu avatarul.
    const startPet = setTimeout(() => petLoop.start(), bounceDelay + 240);

    return () => {
      clearTimeout(startAvatar);
      clearTimeout(startPet);
      avatarLoop.stop();
      petLoop.stop();
      avatarHop.setValue(0);
      petHop.setValue(0);
    };
  }, [bouncing, bounceDelay, avatarHop, petHop]);

  const avatarTranslateY = avatarHop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const petTranslateY = petHop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  return (
    <View
      style={[
        styles.podiumMember,
        {
          width: charW,
          height: charH,
          marginLeft: idx === 0 ? 0 : memberOverlap,
          zIndex: memberCount - idx,
        },
      ]}
    >
      {/* Coronita pe cap, colorata cu rank-ul echipei. Topaie odata cu avatarul. */}
      <Animated.View
        style={[
          styles.podiumCrownOnHead,
          { transform: [{ translateY: avatarTranslateY }] },
        ]}
      >
        <SvgXml
          xml={crownSvg}
          width={crownSize}
          height={Math.round(crownSize * 0.7)}
        />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: avatarTranslateY }] }}>
        {member.avatarSvg ? (
          <SvgXml xml={member.avatarSvg} width={charW} height={charH} />
        ) : (
          <View style={[styles.charFallback, { width: charW, height: charH }]} />
        )}
      </Animated.View>
      {/* Pet stand IN FATA caracterului in coltul jos-dreapta — peek out
          partial ca un sidekick. Topaie pe propriul ritm. */}
      {member.petImageUrl && (
        <Animated.View
          style={[
            styles.podiumPet,
            {
              width: petSize,
              height: petSize,
              right: -Math.round(petSize * 0.25),
              transform: [{ translateY: petTranslateY }],
            },
          ]}
        >
          <Image
            source={{ uri: member.petImageUrl }}
            style={{ width: petSize, height: petSize }}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

// Sampanii — 2 sticle in colturile sus ale podium-ului, cu pop dramatic la
// startul melodiei. Dopurile zboara spre exterior, jet de bubbles iese din
// gura sticlei timp de ~2s. Doar la rank 1 (montat ca peer cu Confetti, ambele
// trigger-uite de acelasi `confettiActive`). Re-monteaza la fiecare activare
// prin runKey ca sa replay-uiasca animatia daca user-ul revine pe ecran.
function Champagne({ active }: { active: boolean }) {
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (active) setRunKey((k) => k + 1);
  }, [active]);
  if (!active) return null;
  return (
    <View pointerEvents="none" style={styles.champagneLayer}>
      <ChampagneBottle key={`L-${runKey}`} side="left" />
      <ChampagneBottle key={`R-${runKey}`} side="right" />
    </View>
  );
}

// SVG sticla de sampanie — corp verde-inchis, gat foiat aurit, eticheta aurie.
// viewBox 30x100; randata la dimensiunea ceruta in props. Fara dopul de sus —
// dopul e o componenta separata animata, ca sa-l putem "scoate" la pop.
const CHAMPAGNE_BOTTLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 100">
  <!-- gat -->
  <rect x="12" y="6" width="6" height="22" fill="#0F3B22"/>
  <!-- foiat auriu pe gat -->
  <rect x="11" y="22" width="8" height="10" fill="#D4AF37"/>
  <rect x="11" y="22" width="8" height="2" fill="#B8941E"/>
  <!-- umar (tranzitie gat-corp) -->
  <path d="M11 32 Q11 36 9 40 L21 40 Q19 36 19 32 Z" fill="#0F3B22"/>
  <!-- corp -->
  <rect x="6" y="40" width="18" height="54" rx="3" fill="#15532F"/>
  <!-- highlight pe corp -->
  <rect x="8" y="44" width="2" height="46" rx="1" fill="#1E7A45" opacity="0.6"/>
  <!-- eticheta -->
  <rect x="8" y="58" width="14" height="20" fill="#F5E6C8"/>
  <rect x="8" y="58" width="14" height="3" fill="#D4AF37"/>
  <rect x="8" y="75" width="14" height="3" fill="#D4AF37"/>
  <!-- baza -->
  <rect x="6" y="92" width="18" height="3" rx="1" fill="#0A2A18"/>
</svg>`;

function ChampagneBottle({ side }: { side: 'left' | 'right' }) {
  // Sticlele intra cu un mic tilt+spring din afara cadrului. Apoi pop —
  // sticla tresare scurt (recoil), dopul zboara, bubbles ies din gura.
  const enter = useRef(new Animated.Value(0)).current;
  const recoil = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    // Mic recoil cand dopul sare — sticla se "trage inapoi" 80ms apoi revine.
    Animated.sequence([
      Animated.delay(180),
      Animated.timing(recoil, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(recoil, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // Dupa ~3s sticla incepe sa se decoloreze ca sa nu ramana acolo agatata
    // toata durata melodiei — pop-ul e bonus vizual, nu element permanent.
    Animated.sequence([
      Animated.delay(2800),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 900,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [enter, recoil, fadeOut]);

  const isLeft = side === 'left';
  // Pozitionate aproape de centru ca sa flancheze coloana rank 1 (centrala in
  // ordinea 2-1-3). Inclinate INWARD — gura sticlei sus catre interior, ca o
  // toasta peste castigator. Pivotul de rotatie e baza sticlei (transformOrigin
  // bottom center in style).
  const baseRotate = isLeft ? 28 : -28;
  // Muzzle = punct de emisie pt bubbles, in local coords ale sticlei (deja
  // rotita). Cu noul tilt inward, muzzleX negativ pt left (bubbles ies in
  // jumatatea inspre-centru), pozitiv pt right.
  const muzzleX = isLeft ? -22 : 22;
  const muzzleY = -22;

  const enterTranslateX = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [isLeft ? -60 : 60, 0],
  });
  const enterTranslateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });
  // Recoil: cand dopul iese spre interior, sticla bumpaie spre EXTERIOR
  // (Newton's 3rd). Pt left = -X (stanga), pt right = +X (dreapta).
  const recoilOffset = recoil.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isLeft ? -6 : 6],
  });
  // Tilt suplimentar in directia inward — sticla se "apleaca" mai mult cand
  // sare dopul, apoi revine.
  const recoilRot = recoil.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${isLeft ? 6 : -6}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.champagneBottle,
        // Pozitionate la ~35% din latimea stage-ului fiecare — flanc coloana
        // centrala (rank 1) fara sa acopere coloanele laterale.
        isLeft ? { left: '34%' } : { right: '34%' },
        {
          opacity: fadeOut,
          transform: [
            { translateX: Animated.add(enterTranslateX, recoilOffset) },
            { translateY: enterTranslateY },
            { rotate: `${baseRotate}deg` },
            { rotate: recoilRot },
          ],
        },
      ]}
    >
      <SvgXml xml={CHAMPAGNE_BOTTLE_SVG} width={32} height={106} />
      {/* Dopul (cork) — porneste pe gura sticlei, zboara spre exterior+sus cu
          spin. Pozitionat absolute relativ la sticla in care e parintele. */}
      <ChampagneCork side={side} />
      {/* Jet de bubbles — 12 cercuri mici care ies din gura sticlei in directia
          inclinarii. Loop scurt: pop initial + cateva valuri suplimentare. */}
      <Bubbles muzzleX={muzzleX} muzzleY={muzzleY} side={side} />
    </Animated.View>
  );
}

function ChampagneCork({ side }: { side: 'left' | 'right' }) {
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(fly, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fly]);

  const isLeft = side === 'left';
  // Cork-ul pleaca de la "gura" sticlei. Cu tilt-ul inward (+28°/-28°), gura e
  // orientata catre centrul podium-ului. Dop-ul zboara spre interior + sus —
  // simbolic ca "spre castigator".
  const corkTranslateX = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isLeft ? 70 : -70],
  });
  const corkTranslateY = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -90],
  });
  const corkRotate = fly.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${isLeft ? -540 : 540}deg`],
  });
  const corkOpacity = fly.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.cork,
        {
          opacity: corkOpacity,
          transform: [
            { translateX: corkTranslateX },
            { translateY: corkTranslateY },
            { rotate: corkRotate },
          ],
        },
      ]}
    />
  );
}

const BUBBLE_COUNT = 14;
const BUBBLE_COLORS = ['#F5E6C8', '#FFF8DC', '#FFFFFF', '#FCE38A'];

function Bubbles({
  muzzleX,
  muzzleY,
  side,
}: {
  muzzleX: number;
  muzzleY: number;
  side: 'left' | 'right';
}) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: BUBBLE_COUNT }).map((_, i) => ({
        id: i,
        size: 4 + Math.random() * 6,
        // Spread lateral — dispersia in jurul jetului central.
        spread: (Math.random() - 0.5) * 60,
        // Cat de departe ajunge bubble-ul pe directia jetului.
        distance: 60 + Math.random() * 70,
        delay: 200 + i * 35 + Math.random() * 80,
        duration: 900 + Math.random() * 400,
        color: BUBBLE_COLORS[i % BUBBLE_COLORS.length]!,
      })),
    [],
  );

  return (
    <>
      {bubbles.map((b) => (
        <Bubble
          key={b.id}
          bubble={b}
          startX={muzzleX}
          startY={muzzleY}
          side={side}
        />
      ))}
    </>
  );
}

function Bubble({
  bubble,
  startX,
  startY,
  side,
}: {
  bubble: {
    size: number;
    spread: number;
    distance: number;
    delay: number;
    duration: number;
    color: string;
  };
  startX: number;
  startY: number;
  side: 'left' | 'right';
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(bubble.delay),
      Animated.timing(t, {
        toValue: 1,
        duration: bubble.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [t, bubble.delay, bubble.duration]);

  const isLeft = side === 'left';
  // Jet-ul iese din gura sticlei in directia inclinarii inward — sticla stanga
  // sufla bubbles spre dreapta (catre centru), sticla dreapta spre stanga.
  // Vizual: cele 2 jeturi se intalnesc peste castigator. Dispersia se aplica
  // perpendicular pe directie ca sa nu fie linie rigida.
  const dirX = isLeft ? 1 : -1;
  const endX = startX + dirX * bubble.distance + bubble.spread * 0.5;
  const endY = startY - bubble.distance * 0.7 + Math.abs(bubble.spread) * 0.3;

  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, endX],
  });
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.4, 1, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: bubble.size,
          height: bubble.size,
          backgroundColor: bubble.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

// Confetti — particule colorate care cad peste podium odata cu melodia. Folosim
// Animated nativ (fara dep nou) — fiecare piesa are translateY 0→jos, rotate
// random si fade-out spre final. Repornim animatia cand `active` flip-eaza pe
// true (key force-remount via internal state).
const CONFETTI_COUNT = 36;
const CONFETTI_COLORS = ['#F1C40F', '#E74C3C', '#2ECC71', '#3498DB', '#9B59B6', '#FF8C42'];
const CONFETTI_DURATION = 2800;
const CONFETTI_FALL = 360;

function Confetti({ active }: { active: boolean }) {
  // Generam piesele O DATA per "activare". Cheia se incrementeaza la fiecare
  // activare astfel incat sa re-monteze copilul si sa replay-uiasca animatia
  // daca user-ul revine pe ecran (ex. dupa back+forward).
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (active) setRunKey((k) => k + 1);
  }, [active]);

  if (!active) return null;
  return <ConfettiBurst key={runKey} />;
}

function ConfettiBurst() {
  // useMemo seed-eaza random-urile o data per mount — fara asta, la fiecare
  // render React ar regenera pozitiile si animatia ar smucki.
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }).map((_, i) => ({
        id: i,
        startX: Math.random(), // 0..1 procent din latime
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        size: 6 + Math.random() * 6,
        rotateStart: Math.random() * 360,
        rotateDelta: (Math.random() - 0.5) * 720,
        delay: Math.random() * 500,
        swayAmp: (Math.random() - 0.5) * 30,
        shape: (Math.random() > 0.5 ? 'square' : 'rect') as 'square' | 'rect',
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} piece={p} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
}: {
  piece: {
    startX: number;
    color: string;
    size: number;
    rotateStart: number;
    rotateDelta: number;
    delay: number;
    swayAmp: number;
    shape: 'square' | 'rect';
  };
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(piece.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: CONFETTI_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [piece.delay, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, CONFETTI_FALL],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, piece.swayAmp, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${piece.rotateStart}deg`, `${piece.rotateStart + piece.rotateDelta}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  const leftPct: `${number}%` = `${Math.round(piece.startX * 100)}%`;
  const h = piece.shape === 'square' ? piece.size : piece.size * 0.45;

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          left: leftPct,
          width: piece.size,
          height: h,
          backgroundColor: piece.color,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    />
  );
}

// Card mare cu XP gained — numarul se animeaza de la 0 pana la final.
function MyXpCard({ amount, rank }: { amount: number; rank: number }) {
  const count = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  const isPodium = rank <= 3;
  const accentColor = isPodium ? RANK_COLOR[rank] ?? colors.success : colors.text;

  useEffect(() => {
    Animated.timing(count, {
      toValue: amount,
      duration: 1200,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = count.addListener(({ value }) => setDisplayed(Math.round(value)));
    return () => count.removeListener(id);
  }, [amount, count]);

  return (
    <View style={styles.xpCard}>
      <Text style={styles.xpLabel}>XP CASTIGATI</Text>
      <View style={styles.xpRow}>
        <Text style={[styles.xpAmount, { color: accentColor }]}>+{displayed}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 32, gap: 20 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },

  header: { gap: 6, marginTop: 8 },
  tag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  // Stage = containerul absolut pt confetti suprapus peste podium. Padding-ul
  // la top da loc coroanelor de pe locul 1; padding orizontal lasa pet-ul din
  // coltul dreapta (right: -pet*0.25) sa iasa partial in afara coloanei fara
  // sa fie taiat.
  podiumStage: {
    position: 'relative',
    paddingTop: 36,
    paddingHorizontal: 14,
  },
  // Podium fizic — 3 trepte cu inaltimi diferite + avatare deasupra. Overflow
  // visible ca sa nu taie crown-urile si pet-urile peek out; intrarea
  // spring-from-below e clip-uita la nivelul fiecarui block individual.
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },

  // Layer absolute peste podium pt confetti. pointerEvents none in JSX —
  // nu blocheaza tap-uri prin el.
  confettiLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },

  // Layer pentru sampanii — peste confetti dar tot in spatele podium-ului
  // logic (vizual e DEASUPRA caracterelor in coltul de sus, dar n-ar trebui
  // sa-i atinga vizual). pointerEvents none.
  champagneLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 11,
  },
  champagneBottle: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 106,
    // Originea rotirii e jos-center (baza sticlei) ca recoil-ul sa fie credibil.
    transformOrigin: 'bottom center',
  },
  // Dopul SVG ar fi exagerat — un cerc plat maro-cream e suficient si rapid.
  cork: {
    position: 'absolute',
    top: -2,
    left: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C19A6B',
    borderWidth: 1,
    borderColor: '#8B6F47',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    left: 11,
    borderRadius: 999,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumChars: {
    alignItems: 'center',
  },
  // Eticheta echipei — nume + scor — randata DEASUPRA caracterelor ca acestea
  // sa stea cu talpile direct pe treapta. Margin-ul de jos da o pauza vizuala
  // intre text si caractere.
  podiumLabel: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 6,
  },
  // Crown overlap-uieste varful avatarului — absolute pozitionata in interiorul
  // podiumMember ca sa nu mute layout-ul caracterului in jos.
  podiumCrownOnHead: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    zIndex: 6,
  },
  // Caracterele stau langa-langa, fara crop circular — full body se vede
  // ca pe podium real. Pet-ul sta IN FATA caracterului (absolute), nu langa,
  // ca sa para realmente lipit. Cand sunt multi membri intr-o echipa,
  // caracterele se imbratiseaza cu overlap dinamic per memberCount.
  podiumLineup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  podiumMember: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  charFallback: {
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
  },
  podiumPet: {
    position: 'absolute',
    bottom: 0,
    zIndex: 5,
  },
  podiumTeamName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    maxWidth: 100,
    textAlign: 'center',
    marginTop: 2,
  },
  podiumTeamNameMine: { color: colors.accent },
  podiumScore: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  podiumRank: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // XP card minimalist — fundal alb, fara culoare puternica
  xpCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 6,
  },
  xpLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  xpAmount: {
    fontSize: 52,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },

  section: { gap: 6 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Team row — compact, fara card-uri masive
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  teamName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  membersStack: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  avatarFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border },
  teamMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  teamScore: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  btnPressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
});
