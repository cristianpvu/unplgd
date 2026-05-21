// Calatoria lui Yoda prin desertul Tatooine.
// Ton: intelept, calm, rabdator, cu topica usor inversata ("Drum lung, ai. Hm.").
// Domeniu: desert, sori, stele, apa, supravietuire, nisip, animale de desert.
//
// Tot textul are diacritice complete (ă â î ș ț) pentru TTS.
// Biome: 'day' (arsita) si 'binary-sunset' (apusul celor doi sori).
// Obstacole: 'boulder', 'vaporator', 'bones'.

import { registerStory } from './registry';
import type { StoryPack } from './types';

const PACK: StoryPack = {
  petSlug: 'baby-yoda',
  title: 'Călătoria lui Yoda prin Tatooine',
  chapters: [
    // ===================================================================
    // CAPITOLUL 1 — Drumul prin arsita
    // ===================================================================
    {
      id: 'yoda-ch1',
      title: 'Drumul prin arșiță',
      biomeKey: 'day',
      introCinematic: 'warp-in',
      scenes: [
        {
          kind: 'narrate',
          id: 'y1-01',
          text: 'Dintr-o lumină blândă, Yoda se ivește pe nisipul fierbinte. Doi sori ard pe cerul desertului Tatooine.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'pet_says',
          id: 'y1-02',
          text: 'Cald, este. Foarte cald, hm. Apă, trebuie să găsim. Răbdare, vom avea.',
        },
        {
          kind: 'narrate',
          id: 'y1-03',
          text: 'Dunele aurii se întind cât vezi cu ochii, iar aerul tremură de căldură deasupra nisipului.',
          vfx: 'zoom-in',
        },
        {
          kind: 'challenge',
          id: 'y1-04',
          intro: 'Un bolovan mare, încins de soare, blochează cărarea dintre dune.',
          shapeKey: 'boulder',
          prompt: 'Piatra, fierbinte este. Spune-mi tu, câți sori are cerul acestui desert, Tatooine?',
          options: ['Unul', 'Doi', 'Trei'],
          correctIndex: 1,
          successLine: 'Doi, sunt. Sori gemeni, ard împreună. Frumos apus, fac seara. Bine ai văzut.',
          failLine: 'Doi, sunt sorii. De aceea, dublă este căldura. Ține minte, tu. Hm.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'y1-05',
          text: 'Yoda atinge bolovanul cu Forța, iar acesta se rostogolește încet din cale.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'encounter',
          id: 'y1-06',
          visitorMode: 'random-friend',
          intro: 'Prin valurile de căldură se apropie {friendPet}, pet-ul prietenului tău {friend}, însetat și obosit.',
          dialog: [
            { speaker: 'visitor', text: 'Yoda! M-am rătăcit în desert. Mă ajuți să găsesc drumul?' },
            { speaker: 'pet', text: 'Ajuta, te voi. Singur în pustiu, nimeni nu trebuie să rămână. Vino, hm.' },
            { speaker: 'visitor', text: 'Mulțumesc. Cu tine alături, nu mi-e teamă de nisip.' },
          ],
          outro: '{friendPet} pășește alături de Yoda, iar amândoi înaintează prin marea de nisip.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'y1-07',
          text: 'Vântul ridică un văl subțire de nisip, care dansează în aer ca o perdea aurie.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'y1-08',
          intro: 'Un vaporizator de umiditate, înalt și ruginit, se înalță în mijlocul cărării.',
          shapeKey: 'vaporator',
          prompt: 'Apă, din aer scoate aceasta. Spune-mi, de ce lucru au nevoie cel mai mult ființele în desert?',
          options: ['Apă', 'Aur', 'Umbră'],
          correctIndex: 0,
          successLine: 'Apă, da. Fără ea, nimic nu trăiește. Pretioasă, în desert este. Înțelept ești.',
          failLine: 'Apă, este. Mai de preț ca aurul, în pustiu. Fără ea, viața se stinge. Hm.',
          vfx: 'rumble',
        },
        {
          kind: 'narrate',
          id: 'y1-09',
          text: 'Vaporizatorul scoate câteva picături reci. Yoda le strânge cu grijă în palmă.',
        },
        {
          kind: 'pet_says',
          id: 'y1-10',
          text: 'Răbdare, ai. Picătură cu picătură, izvor se face. Cea mai mare putere, răbdarea este. Hm.',
        },
        {
          kind: 'narrate',
          id: 'y1-11',
          text: 'Soarele cel mare urcă la zenit, iar nisipul strălucește orbitor sub arșiță.',
          vfx: 'flash',
        },
        {
          kind: 'challenge',
          id: 'y1-12',
          intro: 'Un schelet alb de creatură uriașă iese din nisip, baricadând trecerea.',
          shapeKey: 'bones',
          prompt: 'Oase vechi, povestesc. Spune-mi, ce face nisipul desertului atât de fierbinte ziua?',
          options: ['Vântul', 'Soarele', 'Apa'],
          correctIndex: 1,
          successLine: 'Soarele, da. Razele lui încălzesc nisipul, ore în șir. Cuptor, devine. Bine.',
          failLine: 'Soarele, este. El încinge nisipul toată ziua. De aceea, noaptea mergem. Hm.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'y1-13',
          text: 'Scheletul se prăbușește în nisip, iar calea spre orizont se deschide larg.',
          vfx: 'dust-gust',
        },
        {
          kind: 'farewell',
          id: 'y1-14',
          text: 'Tovarășul lui Yoda își găsește drumul spre casă. Cu o plecăciune recunoscătoare, dispare peste dune.',
          vfx: 'dust-gust',
        },
        {
          kind: 'pet_says',
          id: 'y1-15',
          text: 'Mulțumesc, prieten. Singur, desertul nesfârșit pare. Împreună, drumul mai scurt este. Hm.',
        },
        {
          kind: 'checkpoint',
          id: 'y1-16',
          title: 'Capitolul 1 — Drumul prin arșiță',
          text: 'Ai străbătut dunele Tatooine alături de Yoda și ai aflat tainele desertului. Calea continuă spre apus.',
          reward: { bondXp: 80, backgroundKey: 'yoda-ch1-desert' },
        },
      ],
    },

    // ===================================================================
    // CAPITOLUL 2 — Apusul celor doi sori
    // ===================================================================
    {
      id: 'yoda-ch2',
      title: 'Apusul celor doi sori',
      biomeKey: 'binary-sunset',
      unlockAfter: 'yoda-ch1',
      scenes: [
        {
          kind: 'narrate',
          id: 'y2-01',
          text: 'Cei doi sori coboară spre orizont, iar cerul se aprinde în portocaliu și auriu peste dune.',
          vfx: 'zoom-in',
        },
        {
          kind: 'pet_says',
          id: 'y2-02',
          text: 'Frumos, apusul este. Doi sori, împreună se culcă. Liniște, aduce seara. Hm.',
        },
        {
          kind: 'narrate',
          id: 'y2-03',
          text: 'Pe răcoarea serii, Yoda pornește mai departe. Nisipul își pierde încet arșița zilei.',
        },
        {
          kind: 'challenge',
          id: 'y2-04',
          intro: 'Un bolovan rotund, scăldat în lumina apusului, le stă în cale.',
          shapeKey: 'boulder',
          prompt: 'Răcoare, vine. Spune-mi, de ce călătorii desertului merg mai mult noaptea decât ziua?',
          options: ['E mai frig', 'E mai cald', 'E mai lumină'],
          correctIndex: 0,
          successLine: 'Frig, da. Noaptea răcoroasă este, fără soare. Mai ușor, drumul atunci. Înțelept.',
          failLine: 'Mai frig, este noaptea. Fără sori, nisipul se răcește. Atunci, mergem. Hm.',
          vfx: 'shake',
        },
        {
          kind: 'narrate',
          id: 'y2-05',
          text: 'Yoda ridică bolovanul cu Forța și îl așază blând lângă cărare.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'encounter',
          id: 'y2-06',
          visitorMode: 'random-friend',
          intro: 'Sub cerul aprins apare {friendPet}, pet-ul lui {friend}, ducând o ploscă plină cu apă.',
          dialog: [
            { speaker: 'visitor', text: 'Yoda! Am găsit un izvor. Hai să-l împărțim, drumul e lung!' },
            { speaker: 'pet', text: 'Generos, ești. Împărțit, totul mai dulce devine. Vino, împreună mergem. Hm.' },
            { speaker: 'visitor', text: 'Cu tine pornesc oriunde. Tu cunoști stelele drept hartă.' },
          ],
          outro: '{friendPet} pornește alături de Yoda, iar primele stele se aprind pe cerul de seară.',
          staysAsCompanion: true,
        },
        {
          kind: 'narrate',
          id: 'y2-07',
          text: 'Vântul serii poartă fire fine de nisip, sclipind în ultima lumină a sorilor.',
          vfx: 'dust-gust',
        },
        {
          kind: 'challenge',
          id: 'y2-08',
          intro: 'Un vaporizator vechi, acoperit de praf, blochează poteca spre canion.',
          shapeKey: 'vaporator',
          prompt: 'Stelele, se ivesc. Spune-mi, stelele de pe cer ce sunt, de fapt, când le privești noaptea?',
          options: ['Lămpi', 'Sori îndepărtați', 'Găuri'],
          correctIndex: 1,
          successLine: 'Sori, sunt. Departe, foarte departe. Mici par, dar uriași sunt. Uimitor, nu? Hm.',
          failLine: 'Sori îndepărtați, sunt stelele. Atât de departe, încât mici par. Înțelege, tu.',
          vfx: 'rumble',
        },
        {
          kind: 'narrate',
          id: 'y2-09',
          text: 'Vaporizatorul scârțâie și se dă la o parte, dezvăluind un canion stâncos.',
          vfx: 'shake',
        },
        {
          kind: 'challenge',
          id: 'y2-10',
          intro: 'Un schelet imens de krayt dragon arcuiește peste ultima cărare spre canion.',
          shapeKey: 'bones',
          prompt: 'Ultima taină, astăzi. Spune-mi, ce animal poate trăi mult timp fără apă, în desert?',
          options: ['Cămila', 'Peștele', 'Broasca'],
          correctIndex: 0,
          successLine: 'Cămila, da. Apă păstrează, zile întregi rezistă. Înțeleaptă, natura este. Hm.',
          failLine: 'Cămila, este. Rezerve de apă poartă în trup. Departe merge, fără să bea. Bine.',
          vfx: 'glow-pulse',
        },
        {
          kind: 'narrate',
          id: 'y2-11',
          text: 'Scheletul se năruie în nisip. Deasupra, cei doi sori ating linia orizontului.',
          vfx: 'flash',
        },
        {
          kind: 'pet_says',
          id: 'y2-12',
          text: 'Privește, copile. Doi sori, un apus. Frumusețea, peste tot se află, dacă o cauți. Hm.',
        },
        {
          kind: 'farewell',
          id: 'y2-13',
          text: 'Tovarășul lui Yoda își ia rămas bun, ducând plosca spre tabăra lui de peste dune.',
          vfx: 'dust-gust',
        },
        {
          kind: 'narrate',
          id: 'y2-14',
          text: 'Sorii apun complet, iar mii de stele acoperă cerul desertului ca un giuvaier.',
          vfx: 'shooting-stars',
        },
        {
          kind: 'pet_says',
          id: 'y2-15',
          text: 'Bun, drumul a fost. Cu tine, mereu învăț ceva. Până data viitoare: răbdare, ai. Hm.',
        },
        {
          kind: 'checkpoint',
          id: 'y2-16',
          title: 'Capitolul 2 — Apusul celor doi sori',
          text: 'Ai ajuns la canion alături de Yoda și ai privit apusul celor doi sori. Mintea ta a crescut sub stele.',
          reward: { bondXp: 100, backgroundKey: 'yoda-ch2-apus' },
        },
      ],
    },
  ],
};

registerStory(PACK);
