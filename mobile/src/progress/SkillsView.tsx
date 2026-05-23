// Skills view — grid 2 coloane × 3 randuri cu cele 6 skill-uri.
// Component pur de prezentare (primeste data ca prop), fara fetch propriu.
// Folosit in heroes-book.tsx (own data) si in profile/[id] (public data).

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import type { SkillScore } from '../api/me-progress';

const SKILL_LEVEL_THRESHOLDS = [0, 50, 200, 500, 1000];

const SKILL_LABELS: Record<string, string> = {
  creativitate: 'Creativitate',
  curiozitate: 'Curiozitate',
  sociabilitate: 'Sociabilitate',
  perseverenta: 'Perseverenta',
  logica: 'Logica',
  empatie: 'Empatie',
};

const SKILL_COLORS: Record<string, string> = {
  creativitate: '#FF7A4C',
  curiozitate: '#5BCEFA',
  sociabilitate: '#2ECC71',
  perseverenta: '#7C5CFC',
  logica: '#2F86E0',
  empatie: '#FF4F6B',
};

function skillProgress(score: number, level: number) {
  const idx = Math.max(0, Math.min(SKILL_LEVEL_THRESHOLDS.length - 1, level - 1));
  const floor = SKILL_LEVEL_THRESHOLDS[idx] ?? 0;
  const ceiling = SKILL_LEVEL_THRESHOLDS[idx + 1] ?? floor + 500;
  const span = Math.max(1, ceiling - floor);
  const into = Math.max(0, score - floor);
  return Math.min(1, into / span);
}

export function SkillsView({ skills }: { skills: SkillScore[] }) {
  return (
    <View style={styles.grid}>
      {skills.map((s) => <SkillCard key={s.skill} skill={s} />)}
    </View>
  );
}

function SkillCard({ skill }: { skill: SkillScore }) {
  const label = SKILL_LABELS[skill.skill] ?? skill.skill;
  const accent = SKILL_COLORS[skill.skill] ?? colors.accent;
  const ratio = skillProgress(skill.score, skill.level);

  return (
    <View style={[styles.skillCard, { borderColor: accent + '40' }]}>
      <View style={[styles.skillMedalion, { backgroundColor: accent }]}>
        <Text style={styles.skillMedalionText}>{skill.level}</Text>
      </View>
      <View style={styles.skillBody}>
        <Text style={styles.skillName}>{label}</Text>
        <Text style={[styles.skillLevelName, { color: accent }]}>{skill.levelName}</Text>
        <View style={styles.skillProgressTrack}>
          <View
            style={[
              styles.skillProgressFill,
              { width: `${ratio * 100}%`, backgroundColor: accent },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skillCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
  },
  skillMedalion: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillMedalionText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  skillBody: { flex: 1, gap: 3 },
  skillName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  skillLevelName: { fontSize: 11, fontWeight: '700' },
  skillProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    marginTop: 2,
  },
  skillProgressFill: { height: '100%', borderRadius: 999 },
});
