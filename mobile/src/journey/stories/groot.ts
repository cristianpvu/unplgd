// Calatoria lui Groot prin padurea bioluminescenta.
// Ton: bland, simplu, cald, iubitor de tot ce creste. Groot vorbeste putin si
// pe intelesul tuturor. Domeniu: copaci, plante, seminte, paduri, natura.
//
// Tot textul are diacritice complete (ă â î ș ț) pentru TTS.

import { registerStory } from './registry';
import type { StoryPack } from './types';

const PACK: StoryPack = {
  petSlug: 'groot',
  title: 'Călătoria lui Groot prin pădure',
  chapters: [
    // ===================================================================
    // CAPITOLUL 1 — Pasii prin frunzis
    // ===================================================================
    {
      id: 'groot-ch1',
      title: 'Pașii prin frunziș',
      biomeKey: 'day',
      introCinematic: 'warp-in',
      scenes: [
        {
          kind: 'narrate',
          id: 'g1-01',
          text: 'Dintr-o sămânță de lumină, Groot crește încet până ajunge în picioare, întins spre soare.',
        },
        {
          kind: 'pet_says',
          id: 'g1-02',
          text: 'Eu sunt Groot. (Adică: ce pădure frumoasă! Hai să o explorez.)',
        },
        {
          kind: 'narrate',
          id: 'g1-03',
          text: 'Copacii uriași se înalță spre cer, iar razele soarelui se strecoară printre frunze.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 'g1-04',
          intro: 'O rădăcină uriașă iese din pământ și se încolăcește peste poteca verde.',
          shapeKey: 'giant_root',
          prompt: 'Eu sunt Groot? (Adică: spune-mi, cum afli câți ani are un copac, după ce semn?)',
          options: ['După înălțime', 'După inele', 'După frunze'],
          correctIndex: 1,
          successLine: 'Eu sunt Groot! (După inele! Un inel pentru fiecare an. Ai ghicit!)',
          failLine: 'Eu... sunt Groot. (După inele, prietene. Un inel nou crește în fiecare an.)',
          vfx: 'rumble',
        },
        {
          kind: 'narrate',
          id: 'g1-05',
          text: 'Rădăcina se desface blând și îl lasă pe Groot să treacă mai departe prin frunziș.',
        },
        {
          kind: 'encounter',
          id: 'g1-06',
          visitorMode: 'random-friend',
          intro: 'Printre flori apare {friendPet}, pet-ul prietenului tău {friend}, mirosind o floare uriașă.',
          dialog: [
            { speaker: 'visitor', text: 'Groot! Ce bine că te-am găsit. Pădurea asta e plină de minuni!' },
            { speaker: 'pet', text: 'Eu sunt Groot. (Adică: hai împreună! E mai vesel cu un prieten.)' },
            { speaker: 'visitor', text: 'Cu plăcere! Tu cunoști fiecare frunză de aici.' },
          ],
          outro: '{friendPet} pășește alături de Groot, iar florile se deschid în calea lor.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'g1-07',
          text: 'Spori luminoși plutesc prin aer precum niște steluțe, iar fluturii dansează printre raze.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'g1-08',
          intro: 'O ciupercă uriașă, strălucitoare, crește în mijlocul potecii.',
          shapeKey: 'mushroom',
          prompt: 'Eu sunt Groot? (Adică: ce gaz prețios fac copacii pentru noi să respirăm?)',
          options: ['Oxigen', 'Fum', 'Praf'],
          correctIndex: 0,
          successLine: 'Eu sunt Groot! (Oxigen! Copacii ni-l dăruiesc. De-aia îi iubim.)',
          failLine: 'Eu sunt Groot. (Oxigen, prietene. Copacii îl fac, iar noi îl respirăm.)',
        },
        {
          kind: 'narrate',
          id: 'g1-09',
          text: 'Ciuperca se înclină blând, luminând poteca spre inima pădurii.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'pet_says',
          id: 'g1-10',
          text: 'Eu sunt Groot. (Adică: tot ce crește are nevoie de grijă. Și de timp.)',
        },
        {
          kind: 'narrate',
          id: 'g1-11',
          text: 'Frunzișul se îngroașă și umbrește poteca. Pădurea pare să-și țină respirația.',
          vfx: 'darken',
        },
        {
          kind: 'challenge',
          id: 'g1-12',
          intro: 'O viță înflorită atârnă precum o perdea peste drum, plină de boboci.',
          shapeKey: 'vine',
          prompt: 'Eu sunt Groot? (Adică: dintr-o sămânță mică, ce mare lucru poate crește?)',
          options: ['O piatră', 'Un copac', 'Un nor'],
          correctIndex: 1,
          successLine: 'Eu sunt Groot! (Un copac! Dintr-o sămânță cât un bob. Uimitor, nu?)',
          failLine: 'Eu sunt Groot. (Un copac, prietene. Totul începe dintr-o sămânță mică.)',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 'g1-13',
          text: 'Vița se ridică singură, precum o poartă vie, și îi lasă să treacă în lumină.',
          vfx: 'flash',
        },
        {
          kind: 'farewell',
          id: 'g1-14',
          text: 'Tovarășul lui Groot trebuie să plece spre casă. Îi lasă o floare în dar și dispare printre copaci.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'g1-15',
          text: 'Eu sunt Groot. (Adică: mulțumesc că ai fost cu mine. Prietenii sunt precum florile.)',
        },
        {
          kind: 'checkpoint',
          id: 'g1-16',
          title: 'Capitolul 1 — Pașii prin frunziș',
          text: 'Ai străbătut pădurea verde alături de Groot și ai învățat tainele copacilor. Tot ce crește are o poveste.',
          reward: { bondXp: 80, backgroundKey: 'groot-ch1-padure' },
        },
      ],
    },

    // ===================================================================
    // CAPITOLUL 2 — Padurea stralucitoare
    // ===================================================================
    {
      id: 'groot-ch2',
      title: 'Pădurea strălucitoare',
      biomeKey: 'night',
      unlockAfter: 'groot-ch1',
      scenes: [
        {
          kind: 'narrate',
          id: 'g2-01',
          text: 'Când se lasă noaptea, pădurea se aprinde. Plante, ciuperci și flori strălucesc cu lumina lor.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'pet_says',
          id: 'g2-02',
          text: 'Eu sunt Groot. (Adică: noaptea, pădurea strălucește. E magie vie.)',
        },
        {
          kind: 'narrate',
          id: 'g2-03',
          text: 'Groot pășește prin lumina verde-albăstruie, iar pașii lui trezesc florile adormite.',
        },
        {
          kind: 'challenge',
          id: 'g2-04',
          intro: 'O rădăcină uriașă, plină de mușchi luminos, se ridică în calea lor.',
          shapeKey: 'giant_root',
          prompt: 'Eu sunt Groot? (Adică: ce parte a copacului ține apa și hrana din pământ?)',
          options: ['Frunzele', 'Rădăcinile', 'Scoarța'],
          correctIndex: 1,
          successLine: 'Eu sunt Groot! (Rădăcinile! Ele beau apa din pământ. Foarte bine!)',
          failLine: 'Eu sunt Groot. (Rădăcinile, prietene. Ele sorb apa și hrănesc copacul.)',
          vfx: 'rumble',
        },
        {
          kind: 'narrate',
          id: 'g2-05',
          text: 'Rădăcina luminoasă se dă la o parte, dezvăluind o potecă presărată cu spori strălucitori.',
        },
        {
          kind: 'encounter',
          id: 'g2-06',
          visitorMode: 'random-friend',
          intro: 'Sub un copac strălucitor apare {friendPet}, pet-ul lui {friend}, cu pălăriile pline de polen luminos.',
          dialog: [
            { speaker: 'visitor', text: 'Groot! Pădurea strălucește atât de frumos noaptea. Mergem împreună?' },
            { speaker: 'pet', text: 'Eu sunt Groot. (Adică: da! Lumina e mai frumoasă împărțită.)' },
            { speaker: 'visitor', text: 'Atunci să luminăm noaptea împreună!' },
          ],
          outro: '{friendPet} scutură polenul luminos în aer, iar cei doi pornesc prin pădurea de lumini.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'g2-07',
          text: 'Fluturi bioluminescenți se ridică în roiuri, lăsând dâre de lumină prin întuneric.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 'g2-08',
          intro: 'O ciupercă uriașă, cât un copac, blochează poteca cu pălăria ei luminoasă.',
          shapeKey: 'mushroom',
          prompt: 'Eu sunt Groot? (Adică: ciupercile sunt plante, animale sau cu totul altceva?)',
          options: ['Plante', 'Animale', 'Altceva'],
          correctIndex: 2,
          successLine: 'Eu sunt Groot! (Altceva! Ciupercile sunt un regn aparte. Nici plantă, nici animal.)',
          failLine: 'Eu sunt Groot. (Altceva, prietene. Ciupercile au regnul lor, doar al lor.)',
        },
        {
          kind: 'narrate',
          id: 'g2-09',
          text: 'Ciuperca pulsează de lumină și se înclină, deschizând drumul spre un luminiș magic.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'challenge',
          id: 'g2-10',
          intro: 'O floare uriașă, închisă în boboc, baricadează ultima potecă.',
          shapeKey: 'bloom',
          prompt: 'Eu sunt Groot? (Adică: ce mică viețuitoare ajută florile să facă semințe, zburând din floare în floare?)',
          options: ['Albina', 'Peștele', 'Șopârla'],
          correctIndex: 0,
          successLine: 'Eu sunt Groot! (Albina! Ea duce polenul și ajută florile. Prietena pădurii!)',
          failLine: 'Eu sunt Groot. (Albina, prietene. Ea poartă polenul din floare în floare.)',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 'g2-11',
          text: 'Floarea uriașă se deschide brusc, revărsând o lumină aurie peste întregul luminiș.',
          vfx: 'flash',
        },
        {
          kind: 'pet_says',
          id: 'g2-12',
          text: 'Eu sunt Groot. (Adică: privește! Pădurea ne mulțumește cu lumina ei.)',
        },
        {
          kind: 'farewell',
          id: 'g2-13',
          text: 'Tovarășul lui Groot pleacă spre casă, lăsând în urmă o dâră de polen strălucitor.',
          vfx: 'dust-gust',
        },
        {
          kind: 'narrate',
          id: 'g2-14',
          text: 'Groot rămâne în luminiș, înconjurat de lumini. Pădurea îi cântă încet o melodie blândă.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'pet_says',
          id: 'g2-15',
          text: 'Eu sunt Groot. (Adică: cu tine alături, pădurea strălucește și mai tare. Pe curând!)',
        },
        {
          kind: 'checkpoint',
          id: 'g2-16',
          title: 'Capitolul 2 — Pădurea strălucitoare',
          text: 'Ai luminat noaptea pădurii alături de Groot și ai aflat tainele florilor. Natura ți-a deschis inima.',
          reward: { bondXp: 100, backgroundKey: 'groot-ch2-luminis' },
        },
      ],
    },
  ],
};

registerStory(PACK);
