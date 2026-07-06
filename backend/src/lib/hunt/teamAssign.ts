// Team assignment random pentru lobby members.
//
// Reguli:
//   - Min 4 jucatori (validare in route inainte sa apeleze aici)
//   - Echipele au minim 2 membri, tinta 2-3 (fairness + UI clean)
//   - Maximizam numarul de echipe (mai multa competitie)
//   - Fiecare echipa PRIMESTE MINIM UN JUCATOR CU TELEFON — liderul joaca pe
//     telefonul lui, deci membrii intrati doar cu bratara (viaBracelet) nu pot
//     sustine o echipa singuri. Daca bratarile sunt multe si telefoanele
//     putine, numarul de echipe scade si echipele pot depasi 3 membri.
//
// Exemple (toti cu telefon):
//   N=4 → 2,2
//   N=5 → 2,3
//   N=6 → 2,2,2
//   N=7 → 2,2,3
// Exemplu cu bratari: 2 telefoane + 4 bratari → 2 echipe de 3 (cate un telefon).

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

export type LobbyPlayer = {
  userId: string;
  viaBracelet: boolean;
};

export type TeamPlan = {
  name: string;
  memberIds: string[];
  // Subsetul cu telefon — liderul se alege doar dintre ei.
  phoneMemberIds: string[];
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function assignTeamsRandomly(players: LobbyPlayer[]): TeamPlan[] {
  const n = players.length;
  if (n < 1) {
    throw new Error('Team assign cere minim 1 jucator');
  }

  const phoneIds = shuffle(players.filter((p) => !p.viaBracelet).map((p) => p.userId));
  const braceletIds = shuffle(players.filter((p) => p.viaBracelet).map((p) => p.userId));
  if (phoneIds.length === 0) {
    // Nu ar trebui sa se intample (host-ul e mereu pe telefon) — guard defensiv.
    throw new Error('Team assign cere minim 1 jucator cu telefon');
  }

  // Cazuri dev (1-3 jucatori): o singura echipa cu toti. La 4+ aplicam logica
  // de competitie (min 2 echipe, min 2 membri per echipa).
  const numTeams = n < 4 ? 1 : Math.max(1, Math.min(Math.floor(n / 2), phoneIds.length));

  const namePool = numTeams === 1 ? ['Lupii'] : shuffle(TEAM_NAMES);
  const plans: TeamPlan[] = Array.from({ length: numTeams }, (_, i) => ({
    name: namePool[i] ?? `Echipa ${i + 1}`,
    memberIds: [],
    phoneMemberIds: [],
  }));

  // Intai cate un telefon per echipa (garantia de lider), apoi restul
  // (telefoane ramase + bratari) round-robin — echipele raman echilibrate
  // (marimile difera cu maxim 1).
  const seed = phoneIds.slice(0, numTeams);
  const rest = shuffle([...phoneIds.slice(numTeams), ...braceletIds]);
  const phoneSet = new Set(phoneIds);

  seed.forEach((userId, i) => {
    plans[i]!.memberIds.push(userId);
    plans[i]!.phoneMemberIds.push(userId);
  });
  rest.forEach((userId, i) => {
    const plan = plans[i % numTeams]!;
    plan.memberIds.push(userId);
    if (phoneSet.has(userId)) plan.phoneMemberIds.push(userId);
  });

  return plans;
}
