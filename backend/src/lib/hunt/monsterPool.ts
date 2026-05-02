// Pool de monstri generici — folosit cand parcul nu are ParkContent generat
// inca de Claude (faza 3). Selectie suficient de variata ca o sesiune sa nu
// apara repetitiva chiar si fara AI.
//
// themeTags ajuta selectorul de challenge-uri sa potriveasca tematici (un
// monstru-pasare merge mai bine cu ghicitori despre cer/zbor).

export type GenericMonster = {
  slug: string;
  name: string;
  loreShort: string;
  themeTags: string[];
};

export const GENERIC_MONSTERS: GenericMonster[] = [
  {
    slug: 'spiridus-naznazdravan',
    name: 'Spiriduș Năzdrăvan',
    loreShort: 'Un spiriduș jucauș se ascunde printre arbori si rade incet.',
    themeTags: ['padure', 'fantastic'],
  },
  {
    slug: 'broasca-canta',
    name: 'Broasca Cantatoare',
    loreShort: 'O broasca verde cu glas de soprano. Vrea sa-i invati un cantec.',
    themeTags: ['apa', 'animale'],
  },
  {
    slug: 'bufnita-inteleapta',
    name: 'Bufnița Înțeleaptă',
    loreShort: 'Stie raspunsuri la toate ghicitorile dar te lasa sa incerci.',
    themeTags: ['noapte', 'animale'],
  },
  {
    slug: 'salcia-sopotita',
    name: 'Salcia Șoptitoare',
    loreShort: 'O salcie batrana care soptește secrete vechi.',
    themeTags: ['padure', 'magie'],
  },
  {
    slug: 'pestele-curcubeu',
    name: 'Pestele Curcubeu',
    loreShort: 'Un peste cu solzi multicolori care apare doar cand soarele se reflecta in apa.',
    themeTags: ['apa', 'culori'],
  },
  {
    slug: 'vulpea-rosca',
    name: 'Vulpea Roșcata',
    loreShort: 'Sireata si rapida, ti-a furat un cuvant si vrea sa-l ghicesti.',
    themeTags: ['animale', 'padure'],
  },
  {
    slug: 'iepurele-saritor',
    name: 'Iepurele Săritor',
    loreShort: 'Sare in zigzag printre tufișuri. Ce mananca? Ghici!',
    themeTags: ['animale', 'iarba'],
  },
  {
    slug: 'fluturele-zambitor',
    name: 'Fluturele Zambitor',
    loreShort: 'Zboara incet si lasa praf colorat in urma. Numara petalele!',
    themeTags: ['flori', 'culori'],
  },
  {
    slug: 'gargarita-numarator',
    name: 'Gargarița Numarătoare',
    loreShort: 'Are puncte negre pe spate si vrea sa le numeri.',
    themeTags: ['animale', 'numere'],
  },
  {
    slug: 'caprioara-timida',
    name: 'Caprioara Timida',
    loreShort: 'O caprioara blanda cu ochi mari. Ai nevoie de incredere ca sa o convingi.',
    themeTags: ['animale', 'padure'],
  },
  {
    slug: 'ariciul-curajos',
    name: 'Ariciul Curajos',
    loreShort: 'Un arici mic care se ghemuieste cand se sperie. Spune-i ceva blajin.',
    themeTags: ['animale', 'iarba'],
  },
  {
    slug: 'ciuperca-vorbita',
    name: 'Ciuperca Vorbita',
    loreShort: 'O ciuperca pestrita care da indicii.',
    themeTags: ['padure', 'magie'],
  },
  {
    slug: 'piticul-comoara',
    name: 'Piticul cu Comoara',
    loreShort: 'Un pitic mic ascunde o cheie de aur. Trebuie sa-l prinzi cu o ghicitoare.',
    themeTags: ['fantastic', 'magie'],
  },
  {
    slug: 'corbul-mister',
    name: 'Corbul Misterios',
    loreShort: 'Un corb negru care croncane intrebari grele. Doar curajosii ii raspund.',
    themeTags: ['animale', 'noapte'],
  },
  {
    slug: 'dragonul-aur',
    name: 'Dragonul de Aur',
    loreShort: 'Cel mai rar! Un dragon aurit care apare doar o data pe sesiune. Mare cu mare castig!',
    themeTags: ['fantastic', 'magie', 'rar'],
  },
];

// Selecteaza N monstri random din pool pentru un parc fara content tematic.
// Pentru tipul `gold` rezervam Dragonul (singurul cu tag-ul "rar"). Restul
// sunt random fara repetitie pana se epuizeaza pool-ul; daca cere mai multi
// decat are pool-ul, repeta cu suffix vizibil.
export function pickGenericMonsters(count: number): GenericMonster[] {
  const ordinary = GENERIC_MONSTERS.filter((m) => !m.themeTags.includes('rar'));
  const out: GenericMonster[] = [];
  const shuffled = [...ordinary].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    const base = shuffled[i % shuffled.length]!;
    if (i < shuffled.length) {
      out.push(base);
    } else {
      // Suffix nominal "II", "III" pentru repetari (rare in practica — pool-ul
      // are 14 ordinari, sesiunile au 8-15 monstri).
      out.push({ ...base, name: `${base.name} ${romanNumeral(Math.floor(i / shuffled.length) + 1)}` });
    }
  }
  return out;
}

export function pickGoldMonster(): GenericMonster {
  return GENERIC_MONSTERS.find((m) => m.themeTags.includes('rar')) ?? GENERIC_MONSTERS[0]!;
}

function romanNumeral(n: number): string {
  const map: Array<[number, string]> = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [value, symbol] of map) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}
