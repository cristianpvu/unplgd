// Calatoria lui Vader prin galaxie — 2 capitole pentru testarea flow-ului.
// Ton: cinematic, dramatic, suspans intercalat cu momente calde.
// Domeniu: spatiu, stele, planete, navigatie, forte ascunse.
//
// IMPORTANT: tot textul are diacritice complete (ă, â, î, ș, ț) ca TTS-ul sa
// citeasca natural in romana.
//
// vfx specifice ("se intampla fix ce zice"): meteor, lightning, shooting-stars,
// dust-gust, glow-pulse + generice (flash, shake, darken, rumble, zoom-in).
//
// Reward fundaluri: la fiecare checkpoint, `backgroundKey` deblocheaza un fundal
// (trebuie sa existe in ProfileBackground in DB, populat manual). Vezi
// backend/src/routes/journey.ts → POST /journey/checkpoint.

import { registerStory } from './registry';
import type { StoryPack } from './types';

const PACK: StoryPack = {
  petSlug: 'darth-vader',
  title: 'Călătoria lui Vader prin galaxie',
  chapters: [
    // ===================================================================
    // CAPITOLUL 1 — Pașii roșii pe planeta moartă
    // ===================================================================
    {
      id: 'vader-ch1',
      title: 'Pașii roșii',
      biomeKey: 'deep-space',
      introCinematic: 'crash-pod',
      scenes: [
        {
          kind: 'narrate',
          id: 'v1-01',
          text: 'Praful se așază încet. Din capsula sfărâmată, Vader se ridică în picioare pe planeta moartă.',
        },
        {
          kind: 'narrate',
          id: 'v1-02',
          text: 'În jurul lui sunt doar nisip și liniște. Mantia îi este sfâșiată, dar ochii îi strălucesc.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'v1-03',
          text: 'Liniște... prea multă liniște. Cineva ne urmărește, simt asta.',
        },
        {
          kind: 'narrate',
          id: 'v1-04',
          text: 'Vader pășește hotărât. În depărtare, o stea uriașă pulsează precum o inimă și parcă îl cheamă.',
          vfx: 'zoom-in',
        },
        {
          kind: 'challenge',
          id: 'v1-05',
          intro: 'Un meteorit se rostogolește spre el, lăsând o dâră de scântei. Vader se oprește și ridică mâna.',
          shapeKey: 'asteroid',

          domain: 'spatiu',
          vfx: 'meteor',
        },
        {
          kind: 'narrate',
          id: 'v1-06',
          text: 'Meteoritul se face praf chiar în fața lui. Drumul este liber din nou.',
        },
        {
          kind: 'encounter',
          id: 'v1-07',
          visitorMode: 'random-friend',
          intro: 'În zare apare o siluetă. Este {friendPet}, pet-ul prietenului tău {friend}, rătăcit aici la fel ca Vader.',
          dialog: [
            { speaker: 'visitor', text: 'Vader! Și tu aici? Locul ăsta e tot mai straniu. Cineva a trecut deja pe aici, văd urme.' },
            { speaker: 'pet', text: 'Le-am văzut și eu. Pași grei. Cineva care nu vrea să fie găsit. Hai cu mine, să nu rămâi singur.' },
            { speaker: 'visitor', text: 'Cu tine merg oriunde. Doar să nu te pierzi.' },
          ],
          outro: '{friendPet} pornește alături de Vader. Pașii lor lasă urme dublate în nisipul roșu.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'v1-08',
          text: 'Cerul începe să se întunece, deși este ziuă. O umbră trece pe deasupra lor. O pasăre uriașă? O navă?',
          vfx: 'darken',
        },
        {
          kind: 'pet_says',
          id: 'v1-09',
          text: 'Repede. Trebuie să ajungem la stânca aceea înainte să fim văzuți.',
        },
        {
          kind: 'challenge',
          id: 'v1-10',
          intro: 'Un satelit vechi, pe jumătate îngropat, blochează calea. Vader îl studiază, iar lumina roșie dinăuntru pulsează.',
          shapeKey: 'satellite',

          domain: 'spatiu',
        },
        {
          kind: 'narrate',
          id: 'v1-11',
          text: 'Vader trece pe lângă satelit. Acesta clipește o ultimă dată și se stinge cu un sunet adânc.',
        },
        {
          kind: 'narrate',
          id: 'v1-12',
          text: 'Pe creasta unei dune li se deschide o vale stranie. Cristale roșii cresc din pământ, asemenea unor degete.',
          vfx: 'zoom-in',
        },
        {
          kind: 'challenge',
          id: 'v1-13',
          intro: 'Un cristal uriaș și vibrant blochează poteca. Energia lui face aerul să tremure.',
          shapeKey: 'energybarrier',

          domain: 'spatiu',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 'v1-14',
          text: 'Cristalul crapă cu un pocnet de tunet. Vader înaintează prin valea de așchii sclipitoare.',
          vfx: 'shake',
        },
        {
          kind: 'pet_says',
          id: 'v1-15',
          text: 'Sunt mai aproape acum. Îi simt prezența. Este o veche cunoștință.',
        },
        {
          kind: 'narrate',
          id: 'v1-16',
          text: 'O voce îndepărtată trece prin aer. Un fluierat sau o chemare? Mantia lui Vader se mișcă singură în vânt.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'v1-17',
          intro: 'Un al doilea meteorit vine din altă direcție, parcă aruncat dinadins. Cineva îl urmărește cu adevărat.',
          shapeKey: 'asteroid',

          domain: 'spatiu',
          vfx: 'meteor',
        },
        {
          kind: 'narrate',
          id: 'v1-18',
          text: 'Vader sare în spatele unei stânci. Meteoritul trece la câțiva pași de el și explodează în nisip.',
          vfx: 'flash',
        },
        {
          kind: 'farewell',
          id: 'v1-18b',
          text: 'Tovarășul lui Vader se oprește. Drumurile lor se despart aici. Cu un ultim semn din cap, pleacă spre zarea opusă.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'v1-19',
          text: 'Îți mulțumesc că ești cu mine. Singur, nu aș fi ajuns până aici. Calea continuă mâine.',
        },
        {
          kind: 'checkpoint',
          id: 'v1-20',
          title: 'Capitolul 1 — Pașii roșii',
          text: 'Ai supraviețuit primei zile alături de Vader. Cineva îl urmărește prin galaxie, dar acum amândoi vă puteți odihni.',
          reward: { bondXp: 80, backgroundKey: 'vader-ch1-planeta-rosie' },
        },
      ],
    },

    // ===================================================================
    // CAPITOLUL 2 — Nebuloasa furtunoasă
    // ===================================================================
    {
      id: 'vader-ch2',
      title: 'Nebuloasa furtunoasă',
      biomeKey: 'nebula',
      unlockAfter: 'vader-ch1',
      scenes: [
        {
          kind: 'narrate',
          id: 'v2-01',
          text: 'Când răsare soarele, Vader pășește în nebuloasă. Praf violet plutește peste tot, iar galaxia parcă respiră în jurul lui.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 'v2-02',
          text: 'Lumea asta este vie. Aproape că o pot auzi cântând. Hai să ne grăbim.',
        },
        {
          kind: 'narrate',
          id: 'v2-03',
          text: 'Înaintează prin pulberi colorate. Stele căzătoare brăzdează cerul și lasă dâre aurii în urmă.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'challenge',
          id: 'v2-04',
          intro: 'Un satelit ruginit plutește în cale și transmite un semnal vechi. Cineva încearcă să le vorbească.',
          shapeKey: 'satellite',

          domain: 'spatiu',
          vfx: 'flash',
        },
        {
          kind: 'narrate',
          id: 'v2-05',
          text: 'Satelitul se rotește și dispare în nori. Mesajul a fost transmis, iar Vader știe acum încotro să meargă.',
        },
        {
          kind: 'narrate',
          id: 'v2-06',
          text: 'Vântul cosmic se întețește. Mantia lui Vader flutură precum un steag roșu.',
          vfx: 'dust-gust',
        },
        {
          kind: 'encounter',
          id: 'v2-07',
          visitorMode: 'random-friend',
          intro: 'Printre pulberi apare {friendPet}, pet-ul lui {friend}, gâfâind și cu un cristal mic în mână.',
          dialog: [
            { speaker: 'visitor', text: 'Vader! Am găsit asta. Vibrează în direcția în care mergi. Cred că te poate ghida.' },
            { speaker: 'pet', text: 'Cristalul... este un fragment dintr-o stea moartă. Te-a călăuzit până la mine.' },
            { speaker: 'visitor', text: 'Ia-l tu. Eu m-am pierdut destul. Tu încă știi drumul.' },
            { speaker: 'pet', text: 'Îți mulțumesc, prietene. Nu voi uita gestul tău.' },
          ],
          outro: '{friendPet} rămâne în urmă și salută cu mâna. Vader strânge cristalul și grăbește pasul.',
        },
        {
          kind: 'narrate',
          id: 'v2-08',
          text: 'Cerul se întunecă brusc. Furtuna de stele se apropie, cu particule mici, dar care lovesc precum niște pumni.',
          vfx: 'darken',
        },
        {
          kind: 'challenge',
          id: 'v2-09',
          intro: 'Vader se adăpostește în spatele unui cristal uriaș care vibrează la fiecare lovitură.',
          shapeKey: 'energybarrier',

          domain: 'spatiu',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'v2-10',
          text: 'Furtuna trece și lasă în urmă un cer mai limpede ca oricând. Vader iese din ascunzătoare.',
          vfx: 'flash',
        },
        {
          kind: 'challenge',
          id: 'v2-11',
          intro: 'Drumul coboară într-o vale plină de meteoriți care plutesc. Trebuie să-i ocolească cu grijă.',
          shapeKey: 'asteroid',

          domain: 'spatiu',
          vfx: 'meteor',
        },
        {
          kind: 'narrate',
          id: 'v2-12',
          text: 'Vader pășește printre ei, agil precum o umbră. Cristalul din mâna lui se încălzește.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 'v2-13',
          text: 'Suntem aproape. Pot simți pulsul. Este acolo, ascuns dincolo de orizont.',
        },
        {
          kind: 'narrate',
          id: 'v2-14',
          text: 'O lumină albă apare în fața lor. Nu o stea, ci o relicvă veche, îngropată pe jumătate în pulbere.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 'v2-15',
          intro: 'Un al doilea satelit, mai mic, se aprinde și scanează relicva. Pare s-o protejeze.',
          shapeKey: 'satellite',

          domain: 'spatiu',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 'v2-16',
          text: 'Satelitul încuviințează și se retrage. Relicva se desprinde singură din pulbere și plutește spre Vader.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'pet_says',
          id: 'v2-17',
          text: 'O cunosc. Aceasta este cheia. Cineva mi-a lăsat-o aici, demult, ca s-o găsesc azi.',
        },
        {
          kind: 'narrate',
          id: 'v2-18',
          text: 'Cerul se aprinde de mii de stele deodată. Galaxia îl salută pe Vader cu o lumină blândă.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'pet_says',
          id: 'v2-19',
          text: 'Nu am fost niciodată singur. Ai fost cu mine la fiecare pas. Hai să vedem unde ne duce calea.',
        },
        {
          kind: 'checkpoint',
          id: 'v2-20',
          title: 'Capitolul 2 — Nebuloasa furtunoasă',
          text: 'Ați străbătut nebuloasa furtunoasă și ați găsit relicva. Drumul lui Vader nu s-a sfârșit, dar acum știe încotro să meargă.',
          reward: { bondXp: 100, backgroundKey: 'vader-ch2-nebuloasa' },
        },
      ],
    },
  ],
};

registerStory(PACK);
