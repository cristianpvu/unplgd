// Curba de nivel: level = 1 + floor(sqrt(xp / 100))
// L1: 0 xp, L2: 100, L3: 400, L4: 900, L5: 1600, L6: 2500, L10: 8100
// Cresterea e exponentiala (quadratic), conform specificatiei din plan.

export function xpToLevel(xp: number): number {
  if (xp < 0) return 1;
  return 1 + Math.floor(Math.sqrt(xp / 100));
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
}

export function xpProgress(xp: number) {
  const level = xpToLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    level,
    xp,
    xpIntoLevel: xp - currentLevelXp,
    xpForNextLevel: nextLevelXp - currentLevelXp,
  };
}
