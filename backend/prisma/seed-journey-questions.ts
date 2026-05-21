// Seed pentru pool-ul de intrebari journey. ~50 intrebari per domeniu × 6
// domenii = ~300 intrebari diverse pe varste 6-14. Idempotent: chemam din
// seed.ts si re-creeaza intrebarile lipsa fara duplicate (folosim prompt+domain
// ca cheie logica — prompt-ul exact identifica intrebarea).
//
// Adaugi intrebari noi → adaugi linii in arrayuri si rulezi din nou seed-ul.

import type { PrismaClient } from '@prisma/client';

type Q = {
  prompt: string;
  options: string[];
  correctIndex: number;
  successLine?: string;
  failLine?: string;
  // Varsta tinta — folosita ca filtru. Daca lipseste, e general 6-14.
  minAge?: number;
  maxAge?: number;
};

// ============================================================
// SPATIU — Vader, stele, planete, gravitatie, fizica spatiala
// ============================================================
const SPATIU: Q[] = [
  { prompt: 'Cate planete are sistemul nostru solar?', options: ['Sapte', 'Opt', 'Noua'], correctIndex: 1 },
  { prompt: 'Care este cea mai apropiata stea de Pamant?', options: ['Luna', 'Soarele', 'Steaua Polara'], correctIndex: 1 },
  { prompt: 'Pe ce planeta traim noi?', options: ['Marte', 'Pamant', 'Jupiter'], correctIndex: 1 },
  { prompt: 'Care e cea mai mare planeta din sistemul solar?', options: ['Saturn', 'Jupiter', 'Pamant'], correctIndex: 1 },
  { prompt: 'Ce culoare are planeta Marte?', options: ['Verde', 'Rosie', 'Albastra'], correctIndex: 1 },
  { prompt: 'In spatiu, lumina sau sunetul calatoreste mai rapid?', options: ['Sunetul', 'Lumina', 'La fel'], correctIndex: 1 },
  { prompt: 'Ce inghite si lumina, in spatiu?', options: ['Cometa', 'Gaura neagra', 'Steaua'], correctIndex: 1 },
  { prompt: 'Cati sateliti naturali (luni) are Pamantul?', options: ['Unul', 'Doi', 'Niciunul'], correctIndex: 0 },
  { prompt: 'Care planeta are inele frumoase din ghiata?', options: ['Marte', 'Saturn', 'Venus'], correctIndex: 1 },
  { prompt: 'Ce vede astronautul cand iese din nava in spatiu?', options: ['Cer albastru', 'Intuneric cu stele', 'Nori'], correctIndex: 1 },
  { prompt: 'Cum se numeste calea pe care o face Pamantul in jurul Soarelui?', options: ['Orbita', 'Drum', 'Pista'], correctIndex: 0 },
  { prompt: 'Cat de des Pamantul face un ocol complet in jurul Soarelui?', options: ['O luna', 'Un an', 'O zi'], correctIndex: 1 },
  { prompt: 'In ce zi de an Pamantul face un rotund complet pe propria axa?', options: ['24 de ore', '7 zile', 'O luna'], correctIndex: 0 },
  { prompt: 'Cum se numeste vehiculul care duce astronauti in spatiu?', options: ['Submarin', 'Racheta', 'Avion'], correctIndex: 1 },
  { prompt: 'Ce sunt stelele cazatoare, de fapt?', options: ['Pietre care ard in atmosfera', 'Stele bolnave', 'Pasari noaptea'], correctIndex: 0 },
  { prompt: 'Care planeta e cea mai aproape de Soare?', options: ['Mercur', 'Venus', 'Pamant'], correctIndex: 0 },
  { prompt: 'Cum se numeste galaxia in care traim?', options: ['Andromeda', 'Calea Lactee', 'Sirius'], correctIndex: 1 },
  { prompt: 'Soarele e o stea sau o planeta?', options: ['Planeta', 'Stea', 'Cometa'], correctIndex: 1 },
  { prompt: 'Cum se numeste forta care ne tine pe Pamant si nu plutim?', options: ['Magnetism', 'Gravitatie', 'Vant'], correctIndex: 1 },
  { prompt: 'Luna primeste lumina de la cine?', options: ['De la stele', 'De la Soare', 'O face singura'], correctIndex: 1 },
  { prompt: 'Cum se numeste un grup de stele care formeaza o imagine pe cer?', options: ['Roi', 'Constelatie', 'Multime'], correctIndex: 1 },
  { prompt: 'Cati ani are aproximativ Soarele?', options: ['100 de ani', 'Mii de ani', 'Miliarde de ani'], correctIndex: 2, minAge: 8 },
  { prompt: 'In ce stare e Soarele — solid, lichid sau gaz?', options: ['Solid', 'Lichid', 'Gaz'], correctIndex: 2 },
  { prompt: 'Care planeta se rostogoleste pe-o parte cand orbiteaza?', options: ['Uranus', 'Marte', 'Mercur'], correctIndex: 0, minAge: 9 },
  { prompt: 'Ce e cometa?', options: ['Bila de gheata cu coada', 'Stea mica', 'Roca de pamant'], correctIndex: 0 },
  { prompt: 'Cum se numeste calculul varstei pe stele, in lumina?', options: ['Anul-lumina', 'Anul stelar', 'Anul ceresc'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cine a fost primul om pe Luna?', options: ['Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin'], correctIndex: 1, minAge: 8 },
  { prompt: 'In ce an primul om a pasit pe Luna?', options: ['1969', '1985', '2001'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se numeste statia spatiala internationala pe scurt?', options: ['ISS', 'NASA', 'SPACE'], correctIndex: 0, minAge: 8 },
  { prompt: 'Care planeta are cea mai mare furtuna, numita Marea Pata Rosie?', options: ['Saturn', 'Jupiter', 'Marte'], correctIndex: 1, minAge: 8 },
  { prompt: 'Ce planeta era considerata candva a noua, dar acum nu mai e?', options: ['Pluto', 'Ceres', 'Eris'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se numesc pietrele mari care plutesc intre planete?', options: ['Asteroizi', 'Steluse', 'Lune'], correctIndex: 0 },
  { prompt: 'Ce element chimic arde in Soare pentru a face lumina?', options: ['Apa', 'Hidrogen', 'Aer'], correctIndex: 1, minAge: 9 },
  { prompt: 'Ce planeta are zile mai lungi decat anii?', options: ['Venus', 'Marte', 'Jupiter'], correctIndex: 0, minAge: 10 },
  { prompt: 'Astronautii in spatiu plutesc pentru ca acolo este...', options: ['Vant', 'Gravitatie zero', 'Apa'], correctIndex: 1 },
  { prompt: 'Cum se numesc luminile colorate din cer, vazute spre Polul Nord?', options: ['Aurora boreala', 'Curcubeu', 'Stele'], correctIndex: 0, minAge: 8 },
  { prompt: 'Care planeta seamana cel mai mult cu Pamantul ca marime?', options: ['Marte', 'Venus', 'Saturn'], correctIndex: 1, minAge: 9 },
  { prompt: 'Cum se numeste linia care imparte ziua de noapte pe Pamant?', options: ['Ecuator', 'Linia umbrei', 'Meridian'], correctIndex: 1, minAge: 9 },
  { prompt: 'Ce face Luna sa creasca si sa scada in fiecare luna?', options: ['Pozitia ei fata de Soare', 'Norii', 'Vremea'], correctIndex: 0, minAge: 8 },
  { prompt: 'Care planeta are vant care sufla cu peste 2000 km/h?', options: ['Neptun', 'Marte', 'Mercur'], correctIndex: 0, minAge: 10 },
  { prompt: 'Cum se numeste prima zi cu lumina in care un astronaut a iesit din nava?', options: ['Plimbare spatiala', 'Excursie', 'Vacanta cosmica'], correctIndex: 0, minAge: 8 },
  { prompt: 'Ce calculator de bord ghideaza o racheta?', options: ['Telefonul mobil', 'Calculatorul de zbor', 'Televizorul'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cum se numeste haina speciala a astronautului?', options: ['Salopeta', 'Costum spatial', 'Pijama'], correctIndex: 1 },
  { prompt: 'Cati kilometri are aproximativ distanta de la Pamant la Luna?', options: ['380.000 km', '38.000 km', '3.800 km'], correctIndex: 0, minAge: 10 },
  { prompt: 'Care telescop celebru sta in spatiu si fotografiaza stele?', options: ['Hubble', 'Galileo', 'Newton'], correctIndex: 0, minAge: 9 },
];

// ============================================================
// OCEAN — Stitch, creaturi marine, valuri, plaja, apa
// ============================================================
const OCEAN: Q[] = [
  { prompt: 'Apa din ocean este dulce sau sarata?', options: ['Dulce', 'Sarata', 'Fara gust'], correctIndex: 1 },
  { prompt: 'Cu ce respira pestii sub apa?', options: ['Cu plamanii', 'Cu branhiile', 'Nu respira'], correctIndex: 1 },
  { prompt: 'Delfinul este peste sau mamifer?', options: ['Peste', 'Mamifer', 'Pasare'], correctIndex: 1 },
  { prompt: 'Cum se numeste valul mare care urca pe plaja?', options: ['Talaz', 'Picatura', 'Bulboana'], correctIndex: 0 },
  { prompt: 'Cate brate are o caracatita?', options: ['Sase', 'Opt', 'Zece'], correctIndex: 1 },
  { prompt: 'Care e cea mai mare creatura din ocean?', options: ['Rechinul', 'Balena albastra', 'Caracatita'], correctIndex: 1 },
  { prompt: 'Ce mananca de obicei un peste mic?', options: ['Plancton', 'Iarba', 'Frunze'], correctIndex: 0 },
  { prompt: 'Cu ce instrument se cauta corabii pe fundul marii?', options: ['Telescop', 'Submarin', 'Microscop'], correctIndex: 1 },
  { prompt: 'Ce vegetatie creste in ocean si o mananca pestii?', options: ['Alge', 'Iarba', 'Spini'], correctIndex: 0 },
  { prompt: 'Cum se numeste creatura cu opt brate care isi schimba culoarea?', options: ['Steaua de mare', 'Caracatita', 'Crabul'], correctIndex: 1 },
  { prompt: 'Cum se numeste pestele cu mustati lungi care sta pe fundul apei?', options: ['Somnul', 'Salau', 'Pastravul'], correctIndex: 0, minAge: 8 },
  { prompt: 'Ce creatura traieste in scoici si lasa o perla inauntru uneori?', options: ['Caracatita', 'Stridia', 'Steaua de mare'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cum se face nisipul de plaja, in mare parte?', options: ['Din scoici si pietre tocite', 'Din zahar', 'Din pamant'], correctIndex: 0 },
  { prompt: 'Ce creatura are corp gelatinos si tentacule?', options: ['Meduza', 'Pisica', 'Vrabia'], correctIndex: 0 },
  { prompt: 'Apa oceanului are de obicei o culoare...', options: ['Albastra', 'Rosie', 'Galbena'], correctIndex: 0 },
  { prompt: 'Cum se cheama animalul cu picioare lungi care alearga pe nisip lateral?', options: ['Crabul', 'Soarecele', 'Vrabia'], correctIndex: 0 },
  { prompt: 'Ce face oceanul de doua ori pe zi, urcand si coborand?', options: ['Fierbe', 'Maree', 'Ingheata'], correctIndex: 1 },
  { prompt: 'Cine trage de apa de face mareea?', options: ['Vantul', 'Luna', 'Soarele'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cum se numesc pestii cu dinti ascutiti, vanatori din ocean?', options: ['Caraciuni', 'Rechini', 'Crapi'], correctIndex: 1 },
  { prompt: 'In ce stare a apei este zapada?', options: ['Solida', 'Lichida', 'Gazoasa'], correctIndex: 0 },
  { prompt: 'Cum se numeste aburul cald care urca din apa fierbinte?', options: ['Vapori', 'Fum', 'Praf'], correctIndex: 0 },
  { prompt: 'De unde vine ploaia care umple oceanul?', options: ['Din nori', 'Din pamant', 'Din stele'], correctIndex: 0 },
  { prompt: 'Cum se cheama insula care e de fapt un munte sub apa?', options: ['Insula vulcanica', 'Insula plina', 'Insula goala'], correctIndex: 0, minAge: 9 },
  { prompt: 'Care e cel mai mare ocean al lumii?', options: ['Atlantic', 'Pacific', 'Indian'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cate oceane mari are Pamantul?', options: ['Trei', 'Cinci', 'Sapte'], correctIndex: 1, minAge: 9 },
  { prompt: 'Ce face un peste cu inotatoarele?', options: ['Inoata', 'Mananca', 'Doarme'], correctIndex: 0 },
  { prompt: 'Cum se cheama corabia mica de pescuit?', options: ['Barca', 'Tren', 'Bicicleta'], correctIndex: 0 },
  { prompt: 'Cu ce instrument prinde pescarul pestele?', options: ['Cu pluta', 'Cu undita', 'Cu lopata'], correctIndex: 1 },
  { prompt: 'Ce face soarele apei sa devina vapori?', options: ['O incalzeste', 'O ingheata', 'O agita'], correctIndex: 0 },
  { prompt: 'Cum se numeste partea uscata, mica, inconjurata de apa?', options: ['Insula', 'Munte', 'Continent'], correctIndex: 0 },
  { prompt: 'Care creatura marina cu opt picioare e cunoscuta ca foarte desteapta?', options: ['Caracatita', 'Sardina', 'Scoica'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se numeste tabla de surf?', options: ['Placa', 'Lopata', 'Patura'], correctIndex: 0 },
  { prompt: 'Cum se cheama valul foarte mare si periculos provocat de cutremur?', options: ['Tsunami', 'Furtuna', 'Briza'], correctIndex: 0, minAge: 9 },
  { prompt: 'Ce floare frumoasa creste tropical si poarta numele "hibiscus"?', options: ['O floare', 'Un peste', 'Un fruct'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se cheama palmiera cu fruct mare maro?', options: ['Cocotier', 'Stejar', 'Brad'], correctIndex: 0 },
  { prompt: 'Cum se numeste insula cu vulcani in Pacific, locul lui Stitch?', options: ['Groenlanda', 'Hawaii', 'Sicilia'], correctIndex: 1, minAge: 9 },
  { prompt: 'Ce fruct e tipic tropical, galben pe dinauntru, dulce?', options: ['Ananas', 'Cireasa', 'Mar'], correctIndex: 0 },
  { prompt: 'Cum se cheama animalul cu carapace tare care duce casa in spate?', options: ['Broasca', 'Crab', 'Vulpe'], correctIndex: 1 },
  { prompt: 'Ce sunet face oceanul cand sta linistit?', options: ['Susur', 'Hau', 'Bzzz'], correctIndex: 0 },
  { prompt: 'Cum se cheama partile palmierului cu frunze mari verzi?', options: ['Crengute', 'Frunzis', 'Frunze de palmier'], correctIndex: 2 },
  { prompt: 'Care creatura mica are antene si caruta spirala in spate?', options: ['Melcul', 'Vulpea', 'Iepurele'], correctIndex: 0 },
  { prompt: 'In ce stare e gheata?', options: ['Solida', 'Lichida', 'Gazoasa'], correctIndex: 0 },
  { prompt: 'Ce trebuie sa porti la plaja ca sa nu te arzi de soare?', options: ['Crema de soare', 'Geaca', 'Manusi'], correctIndex: 0 },
  { prompt: 'De ce e bine sa nu lasam gunoaie pe plaja?', options: ['Strica oceanul si animalele', 'E urat la vedere', 'Amandoua'], correctIndex: 2 },
  { prompt: 'Cum se numeste recifa de coral, casa multor pesti?', options: ['Recif', 'Stanca', 'Mlastina'], correctIndex: 0, minAge: 8 },
];

// ============================================================
// PADURE — Groot, copaci, plante, animale de padure
// ============================================================
const PADURE: Q[] = [
  { prompt: 'Cati ani are un copac, daca numeri inelele de pe trunchi?', options: ['Cati inele are', 'Cati ani are radacina', 'Dupa frunze'], correctIndex: 0 },
  { prompt: 'Ce gaz daruiesc copacii pe care noi il respiram?', options: ['Oxigen', 'Fum', 'Praf'], correctIndex: 0 },
  { prompt: 'Cu ce parte copacii prepara hrana din lumina soarelui?', options: ['Cu radacinile', 'Cu frunzele', 'Cu florile'], correctIndex: 1 },
  { prompt: 'Cum se numeste procesul prin care planta isi face hrana din lumina?', options: ['Fotosinteza', 'Digestie', 'Respiratie'], correctIndex: 0, minAge: 8 },
  { prompt: 'Ce parte a copacului tine apa si hrana din pamant?', options: ['Frunzele', 'Radacinile', 'Scoarta'], correctIndex: 1 },
  { prompt: 'Dintr-o samanta mica ce mare lucru poate creste?', options: ['O piatra', 'Un copac', 'Un nor'], correctIndex: 1 },
  { prompt: 'Ciupercile sunt plante, animale sau cu totul altceva?', options: ['Plante', 'Animale', 'Altceva'], correctIndex: 2, minAge: 8 },
  { prompt: 'Ce mica vietuitoare ajuta florile zburand din floare in floare?', options: ['Albina', 'Pestele', 'Soparla'], correctIndex: 0 },
  { prompt: 'Cum se numeste samanta de papadie cand zboara prin aer?', options: ['Parasuta', 'Frunza', 'Petala'], correctIndex: 0 },
  { prompt: 'Ce face un copac toamna cu frunzele lui?', options: ['Le tine verzi', 'Le pierde', 'Le mananca'], correctIndex: 1 },
  { prompt: 'Cum se cheama anotimpul cand cad frunzele?', options: ['Vara', 'Toamna', 'Iarna'], correctIndex: 1 },
  { prompt: 'Cum se cheama copacul cu ace in loc de frunze?', options: ['Stejar', 'Brad', 'Tei'], correctIndex: 1 },
  { prompt: 'Ce mananca un iepure de padure?', options: ['Carne', 'Iarba si morcovi', 'Peste'], correctIndex: 1 },
  { prompt: 'Cum se numeste casa veveritei in copac?', options: ['Cuib', 'Vizuina', 'Adapost'], correctIndex: 0 },
  { prompt: 'Ce mananca o veverita cu pofta?', options: ['Pesti', 'Alune si seminte', 'Iarba'], correctIndex: 1 },
  { prompt: 'Cum cresc ciupercile cel mai bine?', options: ['La soare puternic', 'In locuri umede si umbroase', 'In desert'], correctIndex: 1 },
  { prompt: 'Care animal nocturn de padure are ochii mari si ulula?', options: ['Bufnita', 'Ciocanitoarea', 'Soimul'], correctIndex: 0 },
  { prompt: 'Cu ce ciocaneste ciocanitoarea in copac?', options: ['Cu ciocul', 'Cu picioarele', 'Cu aripile'], correctIndex: 0 },
  { prompt: 'Cum se numeste casa subterana a vulpii?', options: ['Vizuina', 'Cuib', 'Stup'], correctIndex: 0 },
  { prompt: 'Ce face ursul iarna?', options: ['Hiberneaza', 'Inoata', 'Zboara'], correctIndex: 0 },
  { prompt: 'Cum se cheama mancarea preferata a albinelor pe care o aduna?', options: ['Polen si nectar', 'Iarba', 'Frunze'], correctIndex: 0 },
  { prompt: 'Cum se cheama mancarea dulce pe care o fac albinele?', options: ['Mierea', 'Inghetata', 'Ciocolata'], correctIndex: 0 },
  { prompt: 'Cum se cheama frunza care nu cade iarna, ramane mereu verde?', options: ['Vesnic verde', 'Curba', 'Ofilita'], correctIndex: 0 },
  { prompt: 'Ce mananca un cerb in padure?', options: ['Iarba si frunze', 'Carne', 'Pesti'], correctIndex: 0 },
  { prompt: 'Cum se cheama copacul foarte mare cu ghinda?', options: ['Stejar', 'Brad', 'Plop'], correctIndex: 0 },
  { prompt: 'Ce gust are mierea?', options: ['Acra', 'Dulce', 'Amara'], correctIndex: 1 },
  { prompt: 'Cum se cheama animalul cu spini pe spate?', options: ['Vulpea', 'Ariciul', 'Iepurele'], correctIndex: 1 },
  { prompt: 'Ce face un urs daca aude oameni in padure?', options: ['Se ascunde', 'Se uita lung', 'Adesea pleaca'], correctIndex: 2 },
  { prompt: 'De ce e bine sa nu rupem florile din padure?', options: ['Ca sa creasca pentru toti', 'Ca sa nu se enerveze', 'Sunt amare'], correctIndex: 0 },
  { prompt: 'Cum se cheama vechea poveste populara cu fata si lupul in padure?', options: ['Scufita Rosie', 'Alba ca Zapada', 'Cenusareasa'], correctIndex: 0 },
  { prompt: 'Cum se numeste tinerea unui copac pentru a-l ajuta sa creasca dreapta?', options: ['Tutor', 'Lant', 'Greutate'], correctIndex: 0, minAge: 9 },
  { prompt: 'Ce face fotosinteza, simplu spus?', options: ['Transforma lumina in hrana', 'Topeste piatra', 'Face apa rece'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se cheama partea moale verde de pe pietre, in padure?', options: ['Muschi', 'Iarba', 'Lichen'], correctIndex: 0 },
  { prompt: 'Cati ani poate trai un stejar batran?', options: ['10 ani', '100 de ani', '500 sau mai mult'], correctIndex: 2, minAge: 9 },
  { prompt: 'Cum se cheama mancarea unei oide din padure?', options: ['Erbacee', 'Crengute', 'Iarba'], correctIndex: 2 },
  { prompt: 'Cum se ascund pasarile de pradatori in padure?', options: ['Folosesc culorile potrivite', 'Strigatura', 'Fug'], correctIndex: 0 },
  { prompt: 'Cum se cheama prima floare a primaverii?', options: ['Ghiocelul', 'Trandafirul', 'Lalea'], correctIndex: 0 },
  { prompt: 'Cum cresc copacii cei mai inalti — au radacini scurte sau lungi?', options: ['Scurte', 'Lungi', 'Egale'], correctIndex: 1 },
  { prompt: 'Cum se cheama insectele cu sase picioare care fac case din lemn ros?', options: ['Termite', 'Albine', 'Fluturi'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se cheama fluturele in starea lui de mic, cand musca frunze?', options: ['Omida', 'Pui', 'Ou'], correctIndex: 0 },
  { prompt: 'Cum se cheama fenomenul cand un fluture iese din omida?', options: ['Metamorfoza', 'Schimbare', 'Nastere'], correctIndex: 0, minAge: 9 },
  { prompt: 'Care creatura mica are 8 picioare si tese plase?', options: ['Paianjenul', 'Furnica', 'Albina'], correctIndex: 0 },
  { prompt: 'Cate picioare are o insecta (de ex furnica)?', options: ['Patru', 'Sase', 'Opt'], correctIndex: 1 },
  { prompt: 'Cum cresc copacii bradului iarna — au sau nu au ace?', options: ['Au mereu ace', 'Nu au iarna', 'Au doar primavara'], correctIndex: 0 },
  { prompt: 'Cum se cheama vegetatia bogata din padurile tropicale?', options: ['Jungla', 'Desert', 'Mlastina'], correctIndex: 0 },
];

// ============================================================
// DESERT — Yoda Tatooine, dune, sori, supravietuire, apa
// ============================================================
const DESERT: Q[] = [
  { prompt: 'De ce e atat de cald in desert ziua?', options: ['Vantul', 'Soarele care arde puternic', 'Apa'], correctIndex: 1 },
  { prompt: 'Cati sori are planeta Tatooine din Star Wars?', options: ['Unul', 'Doi', 'Trei'], correctIndex: 1 },
  { prompt: 'De ce lucru au cel mai mult nevoie fiintele din desert?', options: ['Apa', 'Aur', 'Umbra'], correctIndex: 0 },
  { prompt: 'Ce animal celebru poate trai mult fara apa, in desert?', options: ['Camila', 'Pestele', 'Broasca'], correctIndex: 0 },
  { prompt: 'Unde isi tine camila rezervele de apa?', options: ['In bot', 'In corp', 'In coada'], correctIndex: 1 },
  { prompt: 'Cum se misca nisipul cand bate vantul puternic in desert?', options: ['Furtuna de nisip', 'Maree', 'Ploaie'], correctIndex: 0 },
  { prompt: 'De ce calatorii din desert merg mai mult noaptea?', options: ['Mai racoare', 'Mai cald', 'Mai lumina'], correctIndex: 0 },
  { prompt: 'Cum se cheama oaza?', options: ['Loc cu apa si copaci', 'Munte mare', 'Lac mare'], correctIndex: 0 },
  { prompt: 'Cum se cheama dealul de nisip din desert?', options: ['Duna', 'Stanca', 'Insula'], correctIndex: 0 },
  { prompt: 'Stelele de pe cer sunt de fapt...', options: ['Lampi', 'Sori departati', 'Gauri'], correctIndex: 1 },
  { prompt: 'Cum se cheama planta cu spini care creste in desert si tine apa inauntru?', options: ['Cactus', 'Bambus', 'Trandafir'], correctIndex: 0 },
  { prompt: 'De ce noaptea in desert e foarte frig, desi ziua e cald?', options: ['Nisipul nu tine caldura', 'Vantul racoreste', 'Amandoua'], correctIndex: 2, minAge: 9 },
  { prompt: 'Cum se numeste vehiculul cu care se traverseaza desertul?', options: ['Avion', 'Camila', 'Submarin'], correctIndex: 1 },
  { prompt: 'Cum se aduna apa noaptea in unele deserturi?', options: ['Roua pe plante', 'Ploaia', 'Izvor'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se cheama persoana care arata calea prin desert?', options: ['Ghid', 'Doctor', 'Profesor'], correctIndex: 0 },
  { prompt: 'Care e cel mai mare desert din lume?', options: ['Sahara', 'Antarctica', 'Gobi'], correctIndex: 1, minAge: 10 },
  { prompt: 'Cum se cheama omul care merge prin desert spre o destinatie?', options: ['Calator', 'Inotator', 'Pilot'], correctIndex: 0 },
  { prompt: 'Cati ani are cea mai veche stea de pe cer (aproximativ)?', options: ['Sute', 'Mii', 'Miliarde'], correctIndex: 2, minAge: 9 },
  { prompt: 'Cum se misca dunele de nisip in timp?', options: ['Sunt aduse de vant', 'Stau pe loc', 'Curg ca apa'], correctIndex: 0 },
  { prompt: 'In Star Wars, ce sunt droizii?', options: ['Animale', 'Roboti', 'Plante'], correctIndex: 1 },
  { prompt: 'Cum se cheama maestrul intelept verde mic din Star Wars?', options: ['Vader', 'Yoda', 'Han'], correctIndex: 1 },
  { prompt: 'Cum se face sticla din nisip?', options: ['Cu foc puternic', 'Cu apa', 'Cu vant'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se cheama instrumentul care arata directiile?', options: ['Busola', 'Termometru', 'Cantar'], correctIndex: 0 },
  { prompt: 'Cum se cheama curentul de aer fierbinte care urca din nisip?', options: ['Miraj termic', 'Briza', 'Ploaie'], correctIndex: 0, minAge: 9 },
  { prompt: 'Ce vede uneori un calator obosit in desert, ca o iluzie?', options: ['Lacuri care nu sunt', 'Stele cazatoare', 'Curcubeu'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se cheama acea iluzie cu apa care nu exista?', options: ['Miraj', 'Vis', 'Ceaca'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se imbraca cineva care merge prin desert ziua?', options: ['Haine largi si deschise la culoare', 'Haine groase', 'In costum de baie'], correctIndex: 0 },
  { prompt: 'Cum se cheama vaporii care urca din apa?', options: ['Abur', 'Fum', 'Praf'], correctIndex: 0 },
  { prompt: 'Cu ce isi protejeaza oamenii ochii in furtuna de nisip?', options: ['Cu ochelari de protectie', 'Cu cana', 'Cu palma'], correctIndex: 0 },
  { prompt: 'Cum se cheama planta de care e legat tot ecosistemul desertului?', options: ['Cactus', 'Tei', 'Brad'], correctIndex: 0 },
  { prompt: 'Cum se aduna apa subterana in desert?', options: ['In fantani', 'In paharel', 'In nori'], correctIndex: 0 },
  { prompt: 'Care planeta din sistemul solar seamana cu un desert urias?', options: ['Marte', 'Pamant', 'Saturn'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se numeste momentul cand soarele apune si cerul se face portocaliu?', options: ['Apus', 'Rasarit', 'Amiaza'], correctIndex: 0 },
  { prompt: 'Cum sunt nuntile in desert: cu sau fara apa?', options: ['Cu apa adusa special', 'Fara apa', 'Fierbinti'], correctIndex: 0, minAge: 10 },
  { prompt: 'Cum se feresc soparlele de caldura?', options: ['Sub piatra, in umbra', 'In apa', 'In aer'], correctIndex: 0 },
  { prompt: 'Cum se cheama oamenii care traiesc in deserturi si calatoresc?', options: ['Nomazi', 'Vanatori', 'Pescari'], correctIndex: 0, minAge: 9 },
  { prompt: 'In Sahara, cu ce animale calatoresc oamenii?', options: ['Camile', 'Lupi', 'Crocodili'], correctIndex: 0 },
  { prompt: 'Ce face vantul in desert cand sufla peste dune?', options: ['Le mareste si le misca', 'Le topeste', 'Le ingheata'], correctIndex: 0 },
  { prompt: 'Cum se cheama partea de jos a unui calator de desert care nu ramane in nisip?', options: ['Talpa lata', 'Coada', 'Aripa'], correctIndex: 0 },
  { prompt: 'In ce stare e apa de roua?', options: ['Lichida', 'Solida', 'Gazoasa'], correctIndex: 0 },
];

// ============================================================
// ORAS — Dog parc, reguli circulatie, reciclare, vecinatate
// ============================================================
const ORAS: Q[] = [
  { prompt: 'La semafor, ce culoare ne spune sa traversam?', options: ['Rosu', 'Verde', 'Galben'], correctIndex: 1 },
  { prompt: 'La semafor, ce culoare ne spune sa stam?', options: ['Verde', 'Rosu', 'Galben'], correctIndex: 1 },
  { prompt: 'In ce coș aruncam pentru ca natura sa ramana curata?', options: ['Oriunde', 'Cosul de gunoi', 'In iarba'], correctIndex: 1 },
  { prompt: 'Cum numim refolosirea hartiei, sticlei si plasticului?', options: ['Reciclare', 'Risipa', 'Murdarie'], correctIndex: 0 },
  { prompt: 'La ce foloseste un hidrant in oras?', options: ['La joaca', 'La stins incendii', 'La decor'], correctIndex: 1 },
  { prompt: 'Cum se cheama oamenii care sting incendiile?', options: ['Politisti', 'Pompieri', 'Doctori'], correctIndex: 1 },
  { prompt: 'Cum se cheama oamenii care ajuta in spital?', options: ['Doctori si asistente', 'Pompieri', 'Profesori'], correctIndex: 0 },
  { prompt: 'Cum se cheama vehiculul cu sirena care duce bolnavii la spital?', options: ['Ambulanta', 'Tren', 'Avion'], correctIndex: 0 },
  { prompt: 'Care simt al cainelui este cel mai puternic?', options: ['Vazul', 'Mirosul', 'Auzul'], correctIndex: 1 },
  { prompt: 'Cate picioare are un caine?', options: ['Doua', 'Patru', 'Sase'], correctIndex: 1 },
  { prompt: 'Cu ce ne deplasam pe trotuar?', options: ['Pe jos', 'Cu masina', 'Cu trenul'], correctIndex: 0 },
  { prompt: 'De ce parte mergem pe trotuar in Romania?', options: ['Pe dreapta', 'Pe stanga', 'Pe mijloc'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se cheama locul cu echipamente unde se joaca copiii?', options: ['Loc de joaca', 'Birou', 'Spital'], correctIndex: 0 },
  { prompt: 'Cum se cheama echipamentul cu panta pe care alunecam in jos?', options: ['Tobogan', 'Leagan', 'Scara'], correctIndex: 0 },
  { prompt: 'Cum se cheama echipamentul de balansat in aer?', options: ['Leagan', 'Tobogan', 'Pat'], correctIndex: 0 },
  { prompt: 'Cum se cheama trecerea peste strada in oras?', options: ['Trecere de pietoni', 'Pista', 'Bulevard'], correctIndex: 0 },
  { prompt: 'Inainte sa traversezi strada, ce trebuie sa faci?', options: ['Sa te uiti in stanga si dreapta', 'Sa fugi', 'Sa-ti pui caciula'], correctIndex: 0 },
  { prompt: 'Cum se cheama vehiculul lung in care intra multi oameni in oras?', options: ['Autobuz', 'Bicicleta', 'Trotineta'], correctIndex: 0 },
  { prompt: 'Cum se cheama persoana care conduce trenul?', options: ['Mecanic de tren', 'Sofer', 'Pilot'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cand un prieten e trist, ce e cel mai bine sa faci?', options: ['Sa-l ignori', 'Sa-l ajuti', 'Sa razi de el'], correctIndex: 1 },
  { prompt: 'Daca un prieten se accidenteaza, ce numar suni in Romania?', options: ['112', '911', '100'], correctIndex: 0, minAge: 8 },
  { prompt: 'De ce e bine sa salutam vecinii?', options: ['Suntem prietenosi', 'Trebuie', 'Pentru cadou'], correctIndex: 0 },
  { prompt: 'Cum se cheama insula din mijlocul strazii pentru pietoni?', options: ['Refugiu', 'Trotuar', 'Pista'], correctIndex: 0, minAge: 9 },
  { prompt: 'Pe bicicleta, ce ar trebui sa avem pe cap pentru siguranta?', options: ['Casca', 'Palarie', 'Caciula'], correctIndex: 0 },
  { prompt: 'Cum se cheama persoana care preda la scoala?', options: ['Profesor sau invatator', 'Doctor', 'Pompier'], correctIndex: 0 },
  { prompt: 'Cum se cheama locul de unde luam carti gratis sa citim?', options: ['Biblioteca', 'Magazin', 'Restaurant'], correctIndex: 0 },
  { prompt: 'Cum se cheama persoana care livreaza scrisorile?', options: ['Postas', 'Pompier', 'Politist'], correctIndex: 0 },
  { prompt: 'Cum se cheama jocul cu mingea unde lovesti cu piciorul?', options: ['Fotbal', 'Basket', 'Volei'], correctIndex: 0 },
  { prompt: 'Cum se cheama jocul cu mingea unde dai cos cu mana?', options: ['Basket', 'Fotbal', 'Tenis'], correctIndex: 0 },
  { prompt: 'Cum se cheama parcul mare central al unui oras, cu copaci si iarba?', options: ['Gradina publica', 'Casa', 'Scoala'], correctIndex: 0 },
  { prompt: 'Cum se cheama legumele si fructele crescute fara pesticide?', options: ['Bio (ecologice)', 'Conserva', 'Inghetate'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se cheama omul care vinde paine in oras?', options: ['Brutar', 'Macelar', 'Pescar'], correctIndex: 0 },
  { prompt: 'Cum se cheama medicul care are grija de dintii nostri?', options: ['Dentist', 'Veterinar', 'Optician'], correctIndex: 0 },
  { prompt: 'Cum se cheama medicul animalelor?', options: ['Veterinar', 'Dentist', 'Inginer'], correctIndex: 0 },
  { prompt: 'Cum se cheama persoana care taie parul?', options: ['Frizer', 'Pictor', 'Cofetar'], correctIndex: 0 },
  { prompt: 'Care e capitala Romaniei?', options: ['Cluj', 'Bucuresti', 'Brasov'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cati ani vrem sa avem ca sa primim carnet de sofer in Romania?', options: ['12', '14', '18'], correctIndex: 2, minAge: 9 },
  { prompt: 'In ce zile mergem la scoala, in general?', options: ['Luni pana vineri', 'Sambata si duminica', 'Doar luni'], correctIndex: 0 },
  { prompt: 'Cum se cheama orele in care nu suntem la scoala vara?', options: ['Vacanta de vara', 'Cantata', 'Lectie'], correctIndex: 0 },
  { prompt: 'Cu ce mergem la munte iarna sa ne dam pe panta?', options: ['Sanie sau schiuri', 'Bicicleta', 'Bara'], correctIndex: 0 },
  { prompt: 'Cum se cheama copacul cu frunze rotunde, plantat in oras?', options: ['Tei', 'Brad', 'Palmier'], correctIndex: 0 },
  { prompt: 'Cum se cheama locul unde sta o familie?', options: ['Casa sau apartament', 'Biroul', 'Magazinul'], correctIndex: 0 },
  { prompt: 'Cati ani are de obicei un copil care merge in clasa intai?', options: ['5', '6 sau 7', '10'], correctIndex: 1 },
  { prompt: 'Cum se cheama instrumentul muzical mare cu clape albe si negre?', options: ['Pian', 'Tobe', 'Trompeta'], correctIndex: 0 },
];

// ============================================================
// GENERAL — backup pentru orice domain. Cultura generala.
// ============================================================
const GENERAL: Q[] = [
  { prompt: 'Ce culoare iese din amestecul rosu cu albastru?', options: ['Verde', 'Mov', 'Portocaliu'], correctIndex: 1 },
  { prompt: 'Ce culoare iese din amestecul galben cu albastru?', options: ['Verde', 'Portocaliu', 'Mov'], correctIndex: 0 },
  { prompt: 'Cate picioare are o paianjenita?', options: ['Sase', 'Opt', 'Zece'], correctIndex: 1 },
  { prompt: 'Cati ani are un copac, daca are 10 inele pe trunchi?', options: ['5', '10', '20'], correctIndex: 1 },
  { prompt: 'Cati centimetri are un metru?', options: ['10', '100', '1000'], correctIndex: 1 },
  { prompt: 'Cati ani are un secol?', options: ['10', '100', '1000'], correctIndex: 1, minAge: 8 },
  { prompt: 'Cate zile are saptamana?', options: ['Cinci', 'Sapte', 'Zece'], correctIndex: 1 },
  { prompt: 'Cate luni are un an?', options: ['Zece', 'Douasprezece', 'Cincisprezece'], correctIndex: 1 },
  { prompt: 'Cum se numeste fenomenul cand vezi ploaie si soare in acelasi timp?', options: ['Furtuna', 'Curcubeu', 'Ceata'], correctIndex: 1 },
  { prompt: 'Cate culori are curcubeul?', options: ['Cinci', 'Sapte', 'Zece'], correctIndex: 1, minAge: 7 },
  { prompt: 'Cum se cheama doctorul de animale?', options: ['Veterinar', 'Pediatru', 'Optician'], correctIndex: 0 },
  { prompt: 'Cati ochi avem in mod normal?', options: ['Doi', 'Trei', 'Patru'], correctIndex: 0 },
  { prompt: 'Cati dinti are un adult, in mod normal?', options: ['20', '32', '50'], correctIndex: 1, minAge: 8 },
  { prompt: 'Care e mare gradul de fierbere al apei in Celsius?', options: ['50', '100', '200'], correctIndex: 1, minAge: 8 },
  { prompt: 'La cate grade Celsius ingheata apa?', options: ['0', '10', '100'], correctIndex: 0, minAge: 7 },
  { prompt: 'Care animal e regele junglei?', options: ['Tigrul', 'Leul', 'Elefantul'], correctIndex: 1 },
  { prompt: 'Cum se cheama animalul cu trompa lunga?', options: ['Elefant', 'Girafa', 'Cangur'], correctIndex: 0 },
  { prompt: 'Cum se cheama animalul cu gat lung din Africa?', options: ['Girafa', 'Hipopotam', 'Lup'], correctIndex: 0 },
  { prompt: 'Care animal sare cu puiul in punguta?', options: ['Cangurul', 'Iepurele', 'Soarecele'], correctIndex: 0 },
  { prompt: 'Care pasare nu zboara dar inoata foarte bine?', options: ['Pinguinul', 'Vrabia', 'Ciocanitoarea'], correctIndex: 0 },
  { prompt: 'Cum se cheama instrumentul cu coarde mic, de pus sub barbie?', options: ['Vioara', 'Pian', 'Tobe'], correctIndex: 0 },
  { prompt: 'Cati metri are un kilometru?', options: ['100', '1000', '10000'], correctIndex: 1, minAge: 8 },
  { prompt: 'Care e prima litera a alfabetului?', options: ['A', 'B', 'Z'], correctIndex: 0 },
  { prompt: 'Care e ultima litera a alfabetului romanesc?', options: ['X', 'Z', 'Y'], correctIndex: 1, minAge: 7 },
  { prompt: 'Cati copii are familia cu trei copii?', options: ['Doi', 'Trei', 'Patru'], correctIndex: 1 },
  { prompt: 'Cum se cheama anotimpul cand ninge?', options: ['Iarna', 'Vara', 'Primavara'], correctIndex: 0 },
  { prompt: 'Cum se cheama anotimpul cu cele mai lungi zile?', options: ['Vara', 'Iarna', 'Toamna'], correctIndex: 0 },
  { prompt: 'Cum se cheama anotimpul cand se nasc florile?', options: ['Primavara', 'Toamna', 'Iarna'], correctIndex: 0 },
  { prompt: 'Care e cea mai mare planeta din sistemul solar?', options: ['Saturn', 'Jupiter', 'Pamant'], correctIndex: 1 },
  { prompt: 'Cati luni naturali are Pamantul?', options: ['Unul', 'Doi', 'Trei'], correctIndex: 0 },
  { prompt: 'Care animal e cel mai rapid pe pamant?', options: ['Calul', 'Ghepardul', 'Leul'], correctIndex: 1, minAge: 8 },
  { prompt: 'Care e cel mai mare animal al lumii?', options: ['Elefantul', 'Balena albastra', 'Tigrul'], correctIndex: 1 },
  { prompt: 'Cati ani are un mileniu?', options: ['100', '1000', '10000'], correctIndex: 1, minAge: 9 },
  { prompt: 'Cum se cheama vehiculul care zboara prin aer?', options: ['Avion', 'Tren', 'Submarin'], correctIndex: 0 },
  { prompt: 'Cum se cheama vehiculul care merge sub apa?', options: ['Submarin', 'Avion', 'Tren'], correctIndex: 0 },
  { prompt: 'Cati ani are un deceniu?', options: ['Zece', 'O suta', 'O mie'], correctIndex: 0, minAge: 8 },
  { prompt: 'Cum se cheama animalul fidelului care apara casa?', options: ['Cainele', 'Pisica', 'Iepurele'], correctIndex: 0 },
  { prompt: 'Care fruct e galben si lung, mancarea preferata a maimutei?', options: ['Banana', 'Pere', 'Mar'], correctIndex: 0 },
  { prompt: 'Care insecta face miere?', options: ['Albina', 'Furnica', 'Tantarul'], correctIndex: 0 },
  { prompt: 'Cati centimetri are jumatate de metru?', options: ['25', '50', '100'], correctIndex: 1 },
  { prompt: 'Cum se cheama numele dat unei vecinatati prietenoase?', options: ['Comunitate', 'Pestera', 'Padure'], correctIndex: 0, minAge: 9 },
  { prompt: 'Cum se cheama lumina puternica de la furtuna?', options: ['Fulger', 'Soare', 'Stea'], correctIndex: 0 },
  { prompt: 'Cum se cheama sunetul puternic de la furtuna?', options: ['Tunet', 'Tipat', 'Mormait'], correctIndex: 0 },
];

const BUCKETS: Record<string, Q[]> = {
  spatiu: SPATIU,
  ocean: OCEAN,
  padure: PADURE,
  desert: DESERT,
  oras: ORAS,
  general: GENERAL,
};

export async function seedJourneyQuestions(prisma: PrismaClient) {
  let added = 0;
  let skipped = 0;
  for (const [domain, list] of Object.entries(BUCKETS)) {
    for (const q of list) {
      // Verificare idempotenta: cautam dupa prompt+domain (combinatie practic unica).
      const existing = await prisma.journeyQuestion.findFirst({
        where: { domain, prompt: q.prompt },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.journeyQuestion.create({
        data: {
          domain,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          successLine: q.successLine ?? 'Asa este!',
          failLine: q.failLine ?? 'Nu chiar, dar e bine ca incercam.',
          minAge: q.minAge ?? 6,
          maxAge: q.maxAge ?? 14,
        },
      });
      added++;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`seedJourneyQuestions: +${added} adaugate, ${skipped} existau deja`);
}
