// Aventura catelusului prin parcul orasului.
// Ton: vesel, loial, energic, prietenos. Catelul vede lumea cu bucurie si
// curiozitate. Domeniu: oras, prietenie, simturile cainelui, reciclare, joaca,
// reguli de circulatie, animale.
//
// Tot textul are diacritice complete (ă â î ș ț) pentru TTS.

import { registerStory } from './registry';
import type { StoryPack } from './types';

const PACK: StoryPack = {
  petSlug: 'dog',
  title: 'Aventura cățelușului prin parc',
  chapters: [
    // ===================================================================
    // CAPITOLUL 1 — O zi in parc
    // ===================================================================
    {
      id: 'dog-ch1',
      title: 'O zi în parc',
      biomeKey: 'noon',
      introCinematic: 'walk-in',
      scenes: [
        {
          kind: 'narrate',
          id: 'd1-01',
          text: 'Cu coada veselă, cățelul intră în parc. Soarele strălucește, iar aerul miroase a iarbă proaspătă.',
        },
        {
          kind: 'pet_says',
          id: 'd1-02',
          text: 'Ham! Ce zi minunată! Atâtea mirosuri, atâtea locuri de explorat! Hai cu mine!',
        },
        {
          kind: 'narrate',
          id: 'd1-03',
          text: 'Frunze aurii cad lin din copaci, iar aleea de parc se întinde printre flori colorate.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'd1-04',
          intro: 'Un hidrant roșu îi stă în cale, exact în mijlocul aleii.',
          shapeKey: 'hydrant',
          prompt: 'Hidrantul ăsta îmi e cunoscut! Spune-mi, care simț al meu este cel mai puternic?',
          options: ['Văzul', 'Mirosul', 'Auzul'],
          correctIndex: 1,
          successLine: 'Mirosul! Adulmec totul de la kilometri. Nasul meu e o minune! Ham!',
          failLine: 'Mirosul, prietene. Noi câinii vedem lumea prin nas mai mult decât prin ochi.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'd1-05',
          text: 'Cățelul ocolește hidrantul cu un salt jucăuș și aleargă mai departe pe alee.',
        },
        {
          kind: 'encounter',
          id: 'd1-06',
          visitorMode: 'random-friend',
          intro: 'De după o bancă apare {friendPet}, pet-ul prietenului tău {friend}, alergând vesel spre el.',
          dialog: [
            { speaker: 'visitor', text: 'Hei! Și tu la plimbare prin parc? Hai să ne jucăm împreună!' },
            { speaker: 'pet', text: 'Ham! Da, da! Doi prieteni se distrează mai bine decât unul! Hai!' },
            { speaker: 'visitor', text: 'Super! Tu cunoști cele mai bune colțuri din parc.' },
          ],
          outro: '{friendPet} se alătură cățelușului, iar cei doi aleargă veseli, unul lângă altul.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'd1-07',
          text: 'Păsările zboară peste copaci, iar un balon roșu plutește departe pe cer.',
          vfx: 'flash',
        },
        {
          kind: 'challenge',
          id: 'd1-08',
          intro: 'O bancă de parc le barează scurtătura printre tufișuri.',
          shapeKey: 'bench',
          prompt: 'Hai să sărim peste! Spune-mi, în ce coș aruncă oamenii ca natura să rămână curată?',
          options: ['Oriunde', 'În coșul de gunoi', 'În iarbă'],
          correctIndex: 1,
          successLine: 'În coșul de gunoi! Așa păstrăm parcul curat pentru toți. Bravo!',
          failLine: 'În coșul de gunoi, prietene. Așa rămâne parcul curat și frumos pentru toată lumea.',
        },
        {
          kind: 'narrate',
          id: 'd1-09',
          text: 'Cățelușii sar peste bancă, urechile fluturând în vânt, și ajung într-o poiană cu flori.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'd1-10',
          text: 'Ham! Îmi place să am grijă de parcul meu. E casa noastră a tuturor!',
        },
        {
          kind: 'narrate',
          id: 'd1-11',
          text: 'Un nor trece peste soare și umbrește pentru o clipă poiana înflorită.',
          vfx: 'darken',
        },
        {
          kind: 'challenge',
          id: 'd1-12',
          intro: 'Un coș de gunoi răsturnat de vânt blochează poteca, cu hârtii împrăștiate în jur.',
          shapeKey: 'trashbin',
          prompt: 'Hai să-l ridicăm! Spune-mi, hârtia, sticla și plasticul, cum le numim când le refolosim?',
          options: ['Reciclare', 'Risipă', 'Murdărie'],
          correctIndex: 0,
          successLine: 'Reciclare! Le dăm o viață nouă în loc să le aruncăm. Ești grozav!',
          failLine: 'Reciclare, prietene. Așa refolosim lucrurile și ajutăm planeta să respire.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'd1-13',
          text: 'Cățelușii strâng hârtiile în coș cu boturile lor. Poiana strălucește din nou, curată.',
          vfx: 'flash',
        },
        {
          kind: 'farewell',
          id: 'd1-14',
          text: 'Tovarășul cățelușului trebuie să se întoarcă acasă la stăpânul lui. Latră vesel un rămas bun și pleacă.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'd1-15',
          text: 'Ham! Mulțumesc că te-ai jucat cu mine. Prietenii fac orice zi mai frumoasă!',
        },
        {
          kind: 'checkpoint',
          id: 'd1-16',
          title: 'Capitolul 1 — O zi în parc',
          text: 'Ai alergat prin parc alături de cățeluș și ai învățat să ai grijă de natură. Ce zi veselă!',
          reward: { bondXp: 80, backgroundKey: 'dog-ch1-parc' },
        },
      ],
    },

    // ===================================================================
    // CAPITOLUL 2 — Aventura de seara
    // ===================================================================
    {
      id: 'dog-ch2',
      title: 'Aventura de seară',
      biomeKey: 'evening',
      unlockAfter: 'dog-ch1',
      scenes: [
        {
          kind: 'narrate',
          id: 'd2-01',
          text: 'Soarele apune peste oraș. Parcul se colorează în portocaliu, iar felinarele încep să se aprindă.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 'd2-02',
          text: 'Ham! Seara în parc e magică. Hai să mai facem o ultimă plimbare!',
        },
        {
          kind: 'narrate',
          id: 'd2-03',
          text: 'Cățelul trece pe lângă clădirile orașului, cu ferestrele aprinse precum niște steluțe calde.',
        },
        {
          kind: 'challenge',
          id: 'd2-04',
          intro: 'Un gard de lemn înconjoară o grădină înflorită, tăind calea cățelușului.',
          shapeKey: 'fence',
          prompt: 'Hai să găsim o trecere! Spune-mi, la semafor, ce culoare ne spune să traversăm?',
          options: ['Roșu', 'Verde', 'Galben'],
          correctIndex: 1,
          successLine: 'Verde! Verde înseamnă că putem trece în siguranță. Știi regulile! Ham!',
          failLine: 'Verde, prietene. La verde traversăm, la roșu așteptăm cuminți.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'd2-05',
          text: 'Cățelul găsește o portiță în gard și se strecoară vesel pe partea cealaltă.',
        },
        {
          kind: 'encounter',
          id: 'd2-06',
          visitorMode: 'random-friend',
          intro: 'Sub un felinar apare {friendPet}, pet-ul lui {friend}, cu o minge în bot.',
          dialog: [
            { speaker: 'visitor', text: 'Hei! Încă o aventură de seară? Am adus și o minge!' },
            { speaker: 'pet', text: 'Ham! O minge! Hai să ne jucăm pe drum spre casă! Vino!' },
            { speaker: 'visitor', text: 'Te urmez! Cu tine, fiecare seară e o aventură.' },
          ],
          outro: '{friendPet} aruncă mingea înainte, iar cei doi aleargă după ea prin lumina felinarelor.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'd2-07',
          text: 'Frunze ruginii se rotesc în aer, purtate de briza răcoroasă a serii.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'd2-08',
          intro: 'Un hidrant ruginit le iese în cale lângă o clădire veche.',
          shapeKey: 'hydrant',
          prompt: 'Încă un hidrant! Spune-mi, la ce folosește cu adevărat un hidrant în oraș?',
          options: ['La joacă', 'La stins incendii', 'La decor'],
          correctIndex: 1,
          successLine: 'La stins incendii! Pompierii iau apă de aici. Foarte important! Ham!',
          failLine: 'La stins incendii, prietene. Pompierii conectează furtunul și iau apă de aici.',
        },
        {
          kind: 'narrate',
          id: 'd2-09',
          text: 'Cățelușii ocolesc hidrantul și ajung într-o piațetă liniștită, luminată de felinare.',
        },
        {
          kind: 'challenge',
          id: 'd2-10',
          intro: 'O bancă lungă le stă în cale, chiar în mijlocul piațetei.',
          shapeKey: 'bench',
          prompt: 'Ultimul obstacol! Spune-mi, când un prieten e trist, ce este cel mai bine să faci?',
          options: ['Să-l ignori', 'Să-l ajuți', 'Să râzi de el'],
          correctIndex: 1,
          successLine: 'Să-l ajuți! Un prieten adevărat e mereu alături. Ai o inimă mare! Ham!',
          failLine: 'Să-l ajuți, prietene. Prietenii adevărați se sprijină mereu unul pe altul.',
          vfx: 'flash',
        },
        {
          kind: 'narrate',
          id: 'd2-11',
          text: 'Cățelușii sar peste bancă împreună și se opresc să privească orașul aprins de lumini.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 'd2-12',
          text: 'Ham! Privește ce frumos strălucește orașul! Și tot mai frumos când ai un prieten alături.',
        },
        {
          kind: 'farewell',
          id: 'd2-13',
          text: 'Tovarășul cățelușului ia mingea și pleacă spre casă. Latră vesel un la revedere și dispare după colț.',
          vfx: 'dust-gust',
        },
        {
          kind: 'narrate',
          id: 'd2-14',
          text: 'Cățelul rămâne în piațetă, sub stele. Orașul îi șoptește încet noapte bună.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'pet_says',
          id: 'd2-15',
          text: 'Ham! A fost o aventură minunată. Cu tine alături, fiecare zi e cea mai bună zi. Pe mâine!',
        },
        {
          kind: 'checkpoint',
          id: 'd2-16',
          title: 'Capitolul 2 — Aventura de seară',
          text: 'Ai colindat orașul de seară alături de cățeluș și ai învățat despre prietenie și bunătate. Ce inimă mare ai!',
          reward: { bondXp: 100, backgroundKey: 'dog-ch2-oras' },
        },
      ],
    },
  ],
};

registerStory(PACK);
