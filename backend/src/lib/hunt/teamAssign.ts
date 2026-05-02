// Team assignment random pentru lobby members.
//
// Reguli:
//   - Min 4 jucatori (validare in route inainte sa apeleze aici)
//   - Echipele au minim 2 membri, maxim 3 (fairness + UI clean)
//   - Maximizam numarul de echipe (mai multa competitie)
//   - Ramasitele se distribuie in ultimele echipe (devin echipe de 3)
//
// Exemple:
//   N=4 → 2,2
//   N=5 → 2,3
//   N=6 → 2,2,2
//   N=7 → 2,2,3
//   N=8 → 2,2,2,2
//   N=9 → 2,2,2,3
//   N=10 → 2,2,2,2,2

const TEAM_NAMES = [
  'Lupii',
  'Bufnitele',
  'Vulpile',
  'Vulturii',
  'Caprioarele',
  'Ursii',
  'Ratele',
  'Castorii',
  'Veveritele',
  'Soimii',
];

export type TeamPlan = {
  name: string;
  memberIds: string[];
};

export function assignTeamsRandomly(memberIds: string[]): TeamPlan[] {
  const n = memberIds.length;
  if (n < 4) {
    throw new Error('Team assign cere minim 4 jucatori');
  }

  const numTeams = Math.floor(n / 2);
  const remainder = n % 2; // 0 sau 1; daca 1, ultima echipa e de 3

  // Sizes: array de marime numTeams cu valori 2, ultima are 2+remainder.
  const sizes = Array(numTeams).fill(2);
  if (remainder === 1 && numTeams > 0) {
    sizes[numTeams - 1] = 3;
  }

  // Shuffle membership ca atribuirea sa fie aleatoare (Fisher-Yates).
  const shuffled = [...memberIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  // Shuffle team names ca etichetele sa fie tematice random, nu mereu "Lupii".
  const namePool = [...TEAM_NAMES].sort(() => Math.random() - 0.5);

  const plans: TeamPlan[] = [];
  let cursor = 0;
  for (let i = 0; i < numTeams; i++) {
    const size = sizes[i] ?? 2;
    plans.push({
      name: namePool[i] ?? `Echipa ${i + 1}`,
      memberIds: shuffled.slice(cursor, cursor + size),
    });
    cursor += size;
  }

  return plans;
}
