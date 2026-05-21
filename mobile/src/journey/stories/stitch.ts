// Aventura lui Stitch pe insula tropicala.
// Ton: jucaus, energic, curios, putin nazdravan. Stitch e un extraterestru
// care a aterizat fortat pe o insula — adora apa, creaturile marine, valurile.
// Domeniu: ocean, creaturi marine, insule, vulcani, ciclul apei.
//
// Tot textul are diacritice complete (ă â î ș ț) pentru TTS.

import { registerStory } from './registry';
import type { StoryPack } from './types';

const PACK: StoryPack = {
  petSlug: 'stitch',
  title: 'Aventura lui Stitch pe insulă',
  chapters: [
    // ===================================================================
    // CAPITOLUL 1 — Naufragiul fericit
    // ===================================================================
    {
      id: 'stitch-ch1',
      title: 'Naufragiul fericit',
      biomeKey: 'noon',
      introCinematic: 'crash-pod',
      scenes: [
        {
          kind: 'narrate',
          id: 's1-01',
          text: 'Nisipul sare în toate părțile. Din capsula fumegândă, Stitch iese rostogolindu-se și râde în hohote.',
        },
        {
          kind: 'pet_says',
          id: 's1-02',
          text: 'Uhuu! Aterizare perfectă! Ei bine... aproape perfectă. Ce loc frumos!',
        },
        {
          kind: 'narrate',
          id: 's1-03',
          text: 'În fața lui se întinde o plajă aurie, iar valurile albastre îl cheamă jucăuș la mal.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 's1-04',
          intro: 'O nucă de cocos uriașă se rostogolește din palmier și îi barează calea pe nisip.',
          shapeKey: 'coconut',
          prompt: 'Nuca asta a căzut din palmier! Spune-mi, apa din ocean este sărată sau dulce?',
          options: ['Dulce', 'Sărată', 'Fără gust'],
          correctIndex: 1,
          successLine: 'Sărată! De-aia te usucă pe limbă dacă înghiți din ea. Bravo!',
          failLine: 'Este sărată, micuțule. De-aceea nu o putem bea precum apa de la robinet.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 's1-05',
          text: 'Stitch sare peste nucă și aleargă spre apă, lăsând urme mici de lăbuțe în nisip.',
        },
        {
          kind: 'encounter',
          id: 's1-06',
          visitorMode: 'random-friend',
          intro: 'Pe un val apare {friendPet}, pet-ul prietenului tău {friend}, plutind voios pe o scândură.',
          dialog: [
            { speaker: 'visitor', text: 'Stitch! Și tu pe insula asta? Hai să explorăm împreună, e plină de surprize!' },
            { speaker: 'pet', text: 'Da, da, da! Împreună e mai distractiv! Vino, să vedem ce ascunde insula!' },
            { speaker: 'visitor', text: 'Te urmez! Doar să nu mănânci toate scoicile.' },
          ],
          outro: '{friendPet} sare pe nisip lângă Stitch și pornesc împreună de-a lungul țărmului.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 's1-07',
          text: 'Soarele strălucește puternic peste apă, făcând să sclipească mii de scântei pe valuri.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 's1-08',
          intro: 'Un crab mare iese din nisip și clămpăne din clești, păzind o cărare de scoici.',
          shapeKey: 'crab',
          prompt: 'Crabul vrea să ne încerce! Știi cu ce respiră peștii sub apă?',
          options: ['Cu plămânii', 'Cu branhiile', 'Nu respiră'],
          correctIndex: 1,
          successLine: 'Cu branhiile! Iau aerul direct din apă. Ești deștept!',
          failLine: 'Cu branhiile, prietene. Ele scot aerul din apă, așa cum noi îl luăm din vânt.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 's1-09',
          text: 'Crabul se dă la o parte, impresionat. Stitch îi face cu ochiul și trece mai departe.',
        },
        {
          kind: 'pet_says',
          id: 's1-10',
          text: 'Aici îmi place! Apă, soare, prieteni... ce mi-aș putea dori mai mult?',
        },
        {
          kind: 'narrate',
          id: 's1-11',
          text: 'Cerul se acoperă dintr-odată cu nori grei. O umbră mare trece peste insulă.',
          vfx: 'darken',
        },
        {
          kind: 'challenge',
          id: 's1-12',
          intro: 'Un trunchi de palmier căzut blochează poteca dintre stânci.',
          shapeKey: 'palm_log',
          prompt: 'Trebuie să-l sărim! Spune-mi, delfinul este pește sau mamifer precum noi?',
          options: ['Pește', 'Mamifer', 'Pasăre'],
          correctIndex: 1,
          successLine: 'Mamifer! Respiră aer la suprafață, exact precum tine și precum mine. Uimitor!',
          failLine: 'Este mamifer, micuțule. Iese la suprafață să respire aer, nu precum peștii.',
        },
        {
          kind: 'narrate',
          id: 's1-13',
          text: 'Stitch și tovarășul lui sar peste trunchi cu un salt vesel și ajung într-un golf ascuns.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 's1-14',
          intro: 'O placă de surf veche plutește în golf, prinsă între două stânci.',
          shapeKey: 'surfboard',
          prompt: 'Hai să o eliberăm! Spune-mi, de unde vine ploaia care umple oceanul?',
          options: ['Din nori', 'Din pământ', 'Din stele'],
          correctIndex: 0,
          successLine: 'Din nori! Apa se ridică, se face nor, apoi cade înapoi. Magie!',
          failLine: 'Din nori, prietene. Apa se ridică în aer, se adună în nori și cade ca ploaie.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 's1-15',
          text: 'Norii se risipesc și soarele iese din nou. Golful strălucește precum o comoară albastră.',
          vfx: 'flash',
        },
        {
          kind: 'farewell',
          id: 's1-16',
          text: 'Tovarășul lui Stitch trebuie să se întoarcă acasă. Îi face cu mâna de pe un val și dispare în larg.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 's1-17',
          text: 'A fost o zi minunată! Mulțumesc că ai fost cu mine. Mâine descoperim și mai multe!',
        },
        {
          kind: 'checkpoint',
          id: 's1-18',
          title: 'Capitolul 1 — Naufragiul fericit',
          text: 'Ai explorat țărmul insulei alături de Stitch. Oceanul ascunde încă multe secrete pentru mâine.',
          reward: { bondXp: 80, backgroundKey: 'stitch-ch1-plaja' },
        },
      ],
    },

    // ===================================================================
    // CAPITOLUL 2 — Muntele care fierbe
    // ===================================================================
    {
      id: 'stitch-ch2',
      title: 'Muntele care fierbe',
      biomeKey: 'sunset',
      unlockAfter: 'stitch-ch1',
      scenes: [
        {
          kind: 'narrate',
          id: 's2-01',
          text: 'La apus, Stitch privește spre munte. Un vulcan adormit fumegă ușor la orizont.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 's2-02',
          text: 'Ooo! Un munte care scoate fum! Trebuie neapărat să-l văd de aproape!',
        },
        {
          kind: 'narrate',
          id: 's2-03',
          text: 'Urcă pe poteca de nisip roșu. Cerul se colorează în portocaliu și roz.',
        },
        {
          kind: 'challenge',
          id: 's2-04',
          intro: 'Un crab pustnic îi taie calea, agitându-și cleștii curios.',
          shapeKey: 'crab',
          prompt: 'Crabul vrea să știe ceva. Spune-mi, ce iese dintr-un vulcan când erupe?',
          options: ['Apă rece', 'Lavă fierbinte', 'Zăpadă'],
          correctIndex: 1,
          successLine: 'Lavă fierbinte! Rocă topită din adâncul pământului. Atenție la ea!',
          failLine: 'Lavă fierbinte, micuțule. Este rocă topită care iese din adâncuri.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 's2-05',
          text: 'Crabul fuge speriat de cuvântul lavă. Stitch chicotește și urcă mai departe.',
        },
        {
          kind: 'encounter',
          id: 's2-06',
          visitorMode: 'random-friend',
          intro: 'Din spatele unei stânci apare {friendPet}, pet-ul lui {friend}, cu o hartă desenată pe o frunză.',
          dialog: [
            { speaker: 'visitor', text: 'Stitch! Am găsit o hartă spre vârful muntelui. Mergem împreună?' },
            { speaker: 'pet', text: 'Bineînțeles! Cu o hartă și un prieten, nimic nu ne oprește!' },
            { speaker: 'visitor', text: 'Atunci să urcăm! Dar ține-mă de labă pe porțiunile abrupte.' },
          ],
          outro: '{friendPet} despătură harta și pornesc împreună spre vârful fumegând.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 's2-07',
          text: 'Vântul fierbinte suflă dinspre crater, purtând cenușă fină prin aer.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 's2-08',
          intro: 'O nucă de cocos arsă de soare se rostogolește spre ei pe pantă.',
          shapeKey: 'coconut',
          prompt: 'Ferește! Spune-mi, insulele tropicale precum aceasta cum se nasc adesea?',
          options: ['Din vulcani', 'Din nori', 'Din nisip'],
          correctIndex: 0,
          successLine: 'Din vulcani! Lava se răcește în apă și construiește insule. Incredibil!',
          failLine: 'Din vulcani, prietene. Lava răcită în ocean clădește, încet, insule noi.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 's2-09',
          text: 'Ajung pe o platformă de unde se vede toată insula, verde și albastră, precum un vis.',
          vfx: 'zoom-in',
        },
        {
          kind: 'challenge',
          id: 's2-10',
          intro: 'Un trunchi de palmier ars zace de-a curmezișul ultimei cărări spre vârf.',
          shapeKey: 'palm_log',
          prompt: 'Ultimul obstacol! Spune-mi, ce face oceanul de două ori pe zi, urcând și coborând?',
          options: ['Fierbe', 'Maree', 'Îngheață'],
          correctIndex: 1,
          successLine: 'Maree! Apa urcă și coboară datorită Lunii. Ea trage de ocean!',
          failLine: 'Se cheamă maree, micuțule. Luna trage de apă și o face să urce și să coboare.',
        },
        {
          kind: 'narrate',
          id: 's2-11',
          text: 'Din crater se înalță un abur cald și auriu. Vulcanul doarme liniștit, nu e periculos azi.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'pet_says',
          id: 's2-12',
          text: 'Privește ce frumos! De aici se vede toată lumea mea. Ohana înseamnă familie!',
        },
        {
          kind: 'farewell',
          id: 's2-13',
          text: 'Tovarășul lui Stitch coboară primul, să ducă vestea acasă. Îi flutură harta în semn de rămas bun.',
          vfx: 'dust-gust',
        },
        {
          kind: 'narrate',
          id: 's2-14',
          text: 'Soarele apune complet, iar stelele încep să sclipească peste insula adormită.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'pet_says',
          id: 's2-15',
          text: 'O insulă minunată, prieteni minunați. Sunt cel mai norocos extraterestru din galaxie!',
        },
        {
          kind: 'checkpoint',
          id: 's2-16',
          title: 'Capitolul 2 — Muntele care fierbe',
          text: 'Ai cucerit vârful vulcanului alături de Stitch și ai văzut toată insula de sus. Ce aventură!',
          reward: { bondXp: 100, backgroundKey: 'stitch-ch2-vulcan' },
        },
      ],
    },
  ],
};

registerStory(PACK);
