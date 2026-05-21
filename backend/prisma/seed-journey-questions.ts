// Seed pentru pool-ul de intrebari journey. Fiecare intrebare are:
//   - prompt: intrebarea (citita de pet)
//   - options + correctIndex
//   - successLine + failLine: reactie scurta de pet
//   - explanation: "stiai ca..." citit de narator dupa, ca sa intareasca
//     cunostinta si sa adauge o curiozitate (chiar daca raspunsul a fost corect).
//
// Idempotent: cheia logica e (domain, prompt). Adaugi intrebari noi → adaugi
// linii in arrayuri si rulezi din nou seed-ul. Daca prompt-ul exista deja,
// REIMPROSPATAM toate campurile (ca sa pot edita explicatii fara duplicate).

import type { PrismaClient } from '@prisma/client';

type Q = {
  prompt: string;
  options: string[];
  correctIndex: number;
  successLine?: string;
  failLine?: string;
  explanation: string;
  minAge?: number;
  maxAge?: number;
};

// ============================================================
// SPATIU — curiozitati despre cosmos
// ============================================================
const SPATIU: Q[] = [
  {
    prompt: 'Pe ce planeta o singura zi dureaza mai mult decat un an intreg?',
    options: ['Venus', 'Marte', 'Saturn'],
    correctIndex: 0,
    explanation: 'Venus se invarte atat de incet, incat o zi acolo dureaza cat 243 de zile pamantesti, mai mult decat anul ei!',
    minAge: 8,
  },
  {
    prompt: 'Care planeta are cea mai mare furtuna din sistemul solar, numita "Marea Pata Rosie"?',
    options: ['Saturn', 'Jupiter', 'Marte'],
    correctIndex: 1,
    explanation: 'Pe Jupiter, furtuna asta uriasa dureaza de peste 350 de ani si incape 2 planete Pamant in ea.',
    minAge: 8,
  },
  {
    prompt: 'In spatiu nu se aude sunetul. De ce?',
    options: ['Pentru ca-i prea departe', 'Nu exista aer prin care sa calatoreasca', 'Stelele il opresc'],
    correctIndex: 1,
    explanation: 'Sunetul are nevoie de aer ca sa se miste. In spatiu e vid total, deci o explozie ar fi muta.',
  },
  {
    prompt: 'Cati sori vede un locuitor de pe planeta Tatooine din Star Wars, la apus?',
    options: ['Unul', 'Doi', 'Trei'],
    correctIndex: 1,
    explanation: 'Tatooine e o planeta cu sori gemeni. In realitate, in galaxie exista cu adevarat planete cu doi sori.',
  },
  {
    prompt: 'Cum se numeste obiectul cosmic atat de masiv incat nici lumina nu poate scapa de el?',
    options: ['Cometa', 'Gaura neagra', 'Quasar'],
    correctIndex: 1,
    explanation: 'Gravitatia unei gauri negre e atat de puternica, ca inghite si lumina. Sunt mormintele stelelor uriase.',
    minAge: 8,
  },
  {
    prompt: 'Cati ani lumina ne desparte de Soare?',
    options: ['8 minute lumina', '1 ora lumina', '1 an lumina'],
    correctIndex: 0,
    explanation: 'Lumina Soarelui ajunge la noi in 8 minute si 20 de secunde. Cand privesti Soarele, vezi cum era el acum 8 minute.',
    minAge: 9,
  },
  {
    prompt: 'Care e cea mai mare planeta din sistemul solar?',
    options: ['Saturn', 'Jupiter', 'Pamant'],
    correctIndex: 1,
    explanation: 'In Jupiter incap peste 1300 de planete Pamant. E o adevarata uriasa gazoasa.',
  },
  {
    prompt: 'Pe ce planeta ar canta-ri un copil de 30 de kilograme doar 11 kilograme?',
    options: ['Marte', 'Venus', 'Mercur'],
    correctIndex: 0,
    explanation: 'Marte are gravitatie de doar 38% din cea a Pamantului, deci ai cantari mult mai putin acolo.',
    minAge: 9,
  },
  {
    prompt: 'Care planeta se invarte culcata pe o parte cand orbiteaza Soarele?',
    options: ['Uranus', 'Marte', 'Mercur'],
    correctIndex: 0,
    explanation: 'Uranus s-a inclinat 98 de grade, probabil dupa o coliziune uriasa. Polii ei stau acolo unde alte planete au ecuatorul.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama galaxia noastra?',
    options: ['Andromeda', 'Calea Lactee', 'Sirius'],
    correctIndex: 1,
    explanation: 'Calea Lactee are intre 100 si 400 de miliarde de stele, iar Soarele e doar una dintre ele.',
  },
  {
    prompt: 'Stelele cazatoare sunt de fapt...',
    options: ['Stele bolnave', 'Pietre care ard in atmosfera', 'Sateliti vechi'],
    correctIndex: 1,
    explanation: 'Sunt bucati mici de praf cosmic care intra in atmosfera si ard de la viteza, lasand o dara stralucitoare.',
  },
  {
    prompt: 'Cati sateliti naturali (luni) are Pamantul?',
    options: ['Unul', 'Doi', 'Niciunul'],
    correctIndex: 0,
    explanation: 'Avem doar Luna noastra. Jupiter, in schimb, are peste 90 de luni!',
  },
  {
    prompt: 'In spatiu, ce calatoreste mai rapid: lumina sau sunetul?',
    options: ['Sunetul', 'Lumina', 'La fel'],
    correctIndex: 1,
    explanation: 'Lumina merge cu 300.000 km/secunda. Sunetul nu poate calatori prin vid, deci in spatiu nu ajunge nicaieri.',
  },
  {
    prompt: 'Cati ani are aproximativ Soarele?',
    options: ['Mii de ani', 'Milioane de ani', 'Miliarde de ani'],
    correctIndex: 2,
    explanation: 'Soarele are aproape 4,6 miliarde de ani si va mai trai inca vreo 5 miliarde inainte sa se transforme in stea uriasa rosie.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama linia imaginara care imparte Pamantul in nord si sud?',
    options: ['Ecuator', 'Meridian', 'Tropic'],
    correctIndex: 0,
    explanation: 'Ecuatorul are 40.075 km lungime. Daca ai merge pe el non-stop cu 5 km/h, ti-ar lua un an de mers.',
    minAge: 9,
  },
  {
    prompt: 'Cum se misca Luna in jurul Pamantului?',
    options: ['In linie dreapta', 'In orbita ovala', 'Sta pe loc'],
    correctIndex: 1,
    explanation: 'Luna face un ocol complet in jurul Pamantului in 27 de zile si se indeparteaza cu 3,8 cm in fiecare an.',
    minAge: 8,
  },
  {
    prompt: 'Care planeta era considerata candva a noua planeta, dar nu mai e?',
    options: ['Pluto', 'Ceres', 'Eris'],
    correctIndex: 0,
    explanation: 'In 2006, astronomii au decis ca Pluto e prea mic ca sa fie planeta. Acum se cheama "planeta pitica".',
    minAge: 8,
  },
  {
    prompt: 'Cine a fost primul om care a pasit pe Luna?',
    options: ['Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin'],
    correctIndex: 1,
    explanation: 'In 1969, Neil Armstrong a pasit primul pe Luna si a spus celebra fraza: "Un pas mic pentru om, un salt urias pentru omenire."',
    minAge: 8,
  },
  {
    prompt: 'Ce sunt aurorele boreale (luminile colorate de la polul nord)?',
    options: ['Reflexii din apa', 'Particule de la Soare care intalnesc atmosfera', 'Stele cazatoare'],
    correctIndex: 1,
    explanation: 'Vantul solar aduce particule incarcate care, lovind atmosfera Pamantului, fac sa straluceasca aerul in verde, roz si violet.',
    minAge: 9,
  },
  {
    prompt: 'Cum se numesc bucatile mari de roca ce plutesc intre Marte si Jupiter?',
    options: ['Lune', 'Asteroizi', 'Comete'],
    correctIndex: 1,
    explanation: 'Sunt mii in centura de asteroizi. Cel mai mare, Ceres, e atat de mare incat e clasificat tot ca planeta pitica.',
    minAge: 8,
  },
  {
    prompt: 'Care e cea mai apropiata stea de Pamant?',
    options: ['Steaua Polara', 'Soarele', 'Luna'],
    correctIndex: 1,
    explanation: 'Soarele e o stea, doar ca foarte aproape. Urmatoarea stea, Proxima Centauri, e la 4 ani lumina distanta.',
  },
  {
    prompt: 'In spatiu, astronautii plutesc pentru ca...',
    options: ['Nu mai au greutate', 'Sunt in cadere continua in jurul Pamantului', 'E magie'],
    correctIndex: 1,
    explanation: 'Statia spatiala cade tot timpul spre Pamant, dar se misca atat de rapid lateral incat il rateaza mereu. Asta se cheama orbita.',
    minAge: 10,
  },
  {
    prompt: 'Cum se numeste haina speciala care protejeaza astronautul in spatiu?',
    options: ['Salopeta', 'Costum spatial', 'Pijama'],
    correctIndex: 1,
    explanation: 'Un costum spatial cantareste peste 130 kg pe Pamant si are sistem propriu de oxigen, racire si comunicatie.',
    minAge: 8,
  },
  {
    prompt: 'Pe care planeta vantul sufla cu peste 2000 km pe ora?',
    options: ['Neptun', 'Marte', 'Mercur'],
    correctIndex: 0,
    explanation: 'Neptun are cele mai rapide vanturi din sistemul solar. La noi cele mai puternice tornade ating doar 500 km/h.',
    minAge: 10,
  },
  {
    prompt: 'Care planeta are inele uriase din ghiata si roca?',
    options: ['Saturn', 'Mercur', 'Venus'],
    correctIndex: 0,
    explanation: 'Inelele lui Saturn au peste 280.000 km diametru, dar sunt incredibil de subtiri — doar zeci de metri grosime.',
  },
  {
    prompt: 'Ce element chimic arde in inima Soarelui pentru a face lumina?',
    options: ['Apa', 'Hidrogen', 'Aer'],
    correctIndex: 1,
    explanation: 'In fiecare secunda, Soarele transforma 600 de milioane de tone de hidrogen in heliu. De acolo vine toata lumina.',
    minAge: 10,
  },
  {
    prompt: 'Cum se cheama luminile aurii care apar pe cer cand intra prafuri cosmice in atmosfera?',
    options: ['Stele cazatoare', 'Curcubeu', 'Soare'],
    correctIndex: 0,
    explanation: 'O ploaie de stele cazatoare se cheama "meteor shower" — uneori vezi sute pe ora cand Pamantul trece printr-un nor de praf.',
    minAge: 8,
  },
  {
    prompt: 'Care planeta seamana cel mai mult cu Pamantul ca marime?',
    options: ['Marte', 'Venus', 'Saturn'],
    correctIndex: 1,
    explanation: 'Venus are cam aceeasi marime ca Pamantul, dar e atat de fierbinte incat ar topi plumbul. Atmosfera ei e plina cu acid.',
    minAge: 9,
  },
  {
    prompt: 'Cu cati ani in urma a aparut viata pe Pamant?',
    options: ['Cateva mii', 'Cateva milioane', 'Cateva miliarde'],
    correctIndex: 2,
    explanation: 'Primele celule au aparut acum aproape 4 miliarde de ani — in oceanele tinere ale Pamantului.',
    minAge: 10,
  },
  {
    prompt: 'Cum se numeste telescopul faimos care fotografiaza stele din spatiu?',
    options: ['Hubble', 'Galileo', 'Newton'],
    correctIndex: 0,
    explanation: 'Telescopul Hubble e in orbita din 1990 si a facut mai mult de 1,5 milioane de poze ale universului.',
    minAge: 9,
  },
];

// ============================================================
// OCEAN — curiozitati despre apa si creaturi marine
// ============================================================
const OCEAN: Q[] = [
  {
    prompt: 'Care creatura marina are 3 inimi si sange albastru?',
    options: ['Caracatita', 'Delfinul', 'Rechinul'],
    correctIndex: 0,
    explanation: 'Caracatita are 3 inimi: 2 pompeaza sangele prin branhii si 1 prin restul corpului. Sangele ei e albastru pentru ca foloseste cupru, nu fier.',
    minAge: 8,
  },
  {
    prompt: 'Delfinul este peste sau mamifer?',
    options: ['Peste', 'Mamifer', 'Pasare'],
    correctIndex: 1,
    explanation: 'Delfinii respira aer la suprafata, isi nasc puii vii si ii alapteaza — exact ca tine si mama ta. Sunt mamifere acvatice.',
  },
  {
    prompt: 'Care creatura marina e cea mai mare din lume?',
    options: ['Rechinul', 'Balena albastra', 'Caracatita'],
    correctIndex: 1,
    explanation: 'Balena albastra poate fi mai lunga de 30 de metri si cantareste cat 30 de elefanti — cel mai mare animal care a trait vreodata!',
  },
  {
    prompt: 'Apa din ocean e sarata pentru ca...',
    options: ['Cineva pune sare in ea', 'Raurile aduc saruri din pietre, milioane de ani', 'Soarele o face sarata'],
    correctIndex: 1,
    explanation: 'Apa de ploaie spala pietrele si aduce minerale in mare. In miliarde de ani, sarea s-a acumulat — peste 35 de grame per litru.',
    minAge: 9,
  },
  {
    prompt: 'Cate brate are o caracatita?',
    options: ['Sase', 'Opt', 'Zece'],
    correctIndex: 1,
    explanation: 'Caracatitele sunt incredibil de istete — pot deschide borcane si recunosc fete de oameni. Numele "octo" vine din greaca: 8.',
  },
  {
    prompt: 'Cum face mareea sa urce si sa coboare in ocean?',
    options: ['Vantul', 'Atractia Lunii', 'Soarele care fierbe apa'],
    correctIndex: 1,
    explanation: 'Luna trage de apa Pamantului. De doua ori pe zi, oceanul se ridica si scade — asta se cheama maree.',
    minAge: 8,
  },
  {
    prompt: 'Steaua de mare poate sa-si regenereze un brat rupt?',
    options: ['Da', 'Nu', 'Doar in laborator'],
    correctIndex: 0,
    explanation: 'Steaua de mare isi reface bratele rupte in cateva luni. Unele specii pot creste un corp intreg dintr-un singur brat ramas.',
    minAge: 8,
  },
  {
    prompt: 'Cum respira pestii sub apa?',
    options: ['Cu plamanii', 'Cu branhiile', 'Nu respira'],
    correctIndex: 1,
    explanation: 'Branhiile scot oxigenul direct din apa, asa cum plamanii nostri il iau din aer. Pestii s-ar sufoca pe uscat.',
  },
  {
    prompt: 'Cati ani poate trai o broasca testoasa marina?',
    options: ['50', '100', 'Peste 150'],
    correctIndex: 2,
    explanation: 'Unele broaste testoase pot trai peste 150 de ani — mai mult decat oricare alt animal vertebrat de pe Pamant.',
    minAge: 8,
  },
  {
    prompt: 'Cum se cheama valul foarte mare si periculos provocat de un cutremur sub apa?',
    options: ['Tsunami', 'Furtuna', 'Briza'],
    correctIndex: 0,
    explanation: 'Cutremurul de pe fundul oceanului ridica milioane de tone de apa. Tsunamiul poate fi inalt de zeci de metri cand ajunge pe tarm.',
    minAge: 9,
  },
  {
    prompt: 'Cati ani are recifa de corali "Great Barrier Reef" din Australia?',
    options: ['100 de ani', 'Mii de ani', '500.000 de ani'],
    correctIndex: 2,
    explanation: 'Marea Bariera de Corali se vede chiar si din spatiu. E cea mai mare structura vie din lume, construita de minuscule animale numite polipi.',
    minAge: 9,
  },
  {
    prompt: 'In ce parte a oceanului traieste pestele lampa (cu lumina pe cap)?',
    options: ['La suprafata', 'In abisuri, foarte adanc', 'In rauri'],
    correctIndex: 1,
    explanation: 'In adancurile intunecate, pestii bioluminescenti isi fac propria lumina ca sa atraga prada sau parteneri.',
    minAge: 9,
  },
  {
    prompt: 'Caluti de mare — cine duce ouale, mama sau tata?',
    options: ['Mama', 'Tata', 'Amandoi'],
    correctIndex: 1,
    explanation: 'La caluti de mare, tatal poarta ouale in punguta lui si naste micutii. E singurul mamifer (de fapt, peste) unde tata "naste".',
    minAge: 8,
  },
  {
    prompt: 'Care e cel mai mare ocean al lumii?',
    options: ['Atlantic', 'Pacific', 'Indian'],
    correctIndex: 1,
    explanation: 'Oceanul Pacific e atat de mare, incat acopera o treime din Pamant — incap toate continentele in el cu loc liber.',
    minAge: 8,
  },
  {
    prompt: 'Cum se numeste insula care e de fapt un munte sub apa care iese deasupra?',
    options: ['Insula vulcanica', 'Insula plina', 'Insula plata'],
    correctIndex: 0,
    explanation: 'Hawaii s-a nascut din vulcani submarini. Daca masurezi muntele Mauna Kea de la baza din ocean, e mai inalt decat Everest!',
    minAge: 9,
  },
  {
    prompt: 'Meduzele au creier?',
    options: ['Da, unul mic', 'Nu, nici inima', 'Au trei creieri'],
    correctIndex: 1,
    explanation: 'Meduzele n-au creier, nici inima, nici sange. Sunt 95% apa si traiesc in oceane de peste 500 de milioane de ani.',
    minAge: 8,
  },
  {
    prompt: 'Cati litri de apa beu o balena pe zi?',
    options: ['Niciunul', '100 de litri', 'Mii de litri'],
    correctIndex: 0,
    explanation: 'Balenele nu beau apa — iau toata apa de care au nevoie din hrana lor. Nici pestii pe care ii mananca nu sunt sarati pe interior.',
    minAge: 9,
  },
  {
    prompt: 'Care animal traieste pe uscat dar isi face ouale in nisip, pe plaja?',
    options: ['Crabul pustnic', 'Broasca testoasa marina', 'Caracatita'],
    correctIndex: 1,
    explanation: 'Broastele testoase marine se intorc dupa zeci de ani pe plaja unde s-au nascut, ca sa-si ingroape ouale in nisip.',
    minAge: 8,
  },
  {
    prompt: 'Cum se numesc curentii oceanici uriasi care misca apa pe glob?',
    options: ['Vanturi marine', 'Curenti oceanici', 'Maree'],
    correctIndex: 1,
    explanation: 'Gulf Stream transporta apa calda din Caraibe spre Europa de Nord. Fara el, Anglia ar fi inghetata ca Siberia.',
    minAge: 10,
  },
  {
    prompt: 'Cum se cheama mancarea preferata a balenelor mari?',
    options: ['Plancton', 'Pesti', 'Alge'],
    correctIndex: 0,
    explanation: 'Balena albastra mananca pana la 4 tone de plancton (mici creaturi) pe zi, desi e cel mai mare animal din lume.',
  },
  {
    prompt: 'Care creatura marina e cunoscuta ca cea mai desteapta?',
    options: ['Caracatita', 'Sardina', 'Scoica'],
    correctIndex: 0,
    explanation: 'Caracatitele pot folosi unelte, rezolva puzzle-uri si chiar deschid borcane. Au mai multi neuroni decat unele animale terestre.',
    minAge: 8,
  },
  {
    prompt: 'Cum se cheama palmiera tropicala cu fruct mare maro?',
    options: ['Cocotier', 'Stejar', 'Brad'],
    correctIndex: 0,
    explanation: 'Cocotierul poate trai 80 de ani si o nuca de cocos pluteste pe ocean luni intregi — asa s-a raspandit in toate insulele tropicale.',
  },
  {
    prompt: 'Cati centimetri ai cobora cand intri intr-o piscina daca tii in mana o piatra mare?',
    options: ['Mai mult', 'Mai putin', 'La fel'],
    correctIndex: 0,
    explanation: 'Piatra te face mai greu. Asta se cheama legea lui Arhimede — esti mai usor in apa, dar piatra te trage in jos.',
    minAge: 9,
  },
  {
    prompt: 'De ce nu ingheata oceanul iarna?',
    options: ['E prea sarat', 'E adanc', 'Amandoua'],
    correctIndex: 2,
    explanation: 'Apa sarata ingheata la -2°C, nu la 0°C. Plus, oceanul e mereu in miscare si are atatea miliarde de litri ca nu se raceste tot.',
    minAge: 10,
  },
  {
    prompt: 'Cati metri adanc poate cobori un cachalot (balena cu cap mare) sa vaneze?',
    options: ['100 m', '1.000 m', 'Peste 2.000 m'],
    correctIndex: 2,
    explanation: 'Cachalotul poate cobori peste 2 km si tine respiratia 90 de minute, ca sa caute calmari uriasi pe care ii vaneaza.',
    minAge: 10,
  },
];

// ============================================================
// PADURE — curiozitati despre copaci, plante, animale de padure
// ============================================================
const PADURE: Q[] = [
  {
    prompt: 'Cum vorbesc copacii intre ei?',
    options: ['Nu vorbesc', 'Prin radacini si ciuperci subterane', 'Cu frunzele in vant'],
    correctIndex: 1,
    explanation: 'Sub pamant, copacii sunt legati printr-o retea de ciuperci. Asa isi trimit hrana si avertismente cand sunt atacati de insecte.',
    minAge: 9,
  },
  {
    prompt: 'Cati ani are un copac, daca are 50 de inele pe trunchi?',
    options: ['25', '50', '100'],
    correctIndex: 1,
    explanation: 'Fiecare inel = un an. Inelele groase = an cu multa apa si soare. Inelele subtiri = an de seceta.',
  },
  {
    prompt: 'Cum se cheama procesul prin care plantele transforma lumina in hrana?',
    options: ['Fotosinteza', 'Digestie', 'Respiratie'],
    correctIndex: 0,
    explanation: 'In fotosinteza, planta ia CO2 din aer, apa din pamant si lumina de la Soare, si face zahar. Ne da oxigen pe deasupra.',
    minAge: 8,
  },
  {
    prompt: 'Care e cel mai inalt copac din lume?',
    options: ['Stejarul', 'Sequoia', 'Bradul'],
    correctIndex: 1,
    explanation: 'In California, un sequoia numit "Hyperion" e inalt de 116 metri — cat un bloc cu 35 de etaje.',
    minAge: 8,
  },
  {
    prompt: 'Care animal poate trai pana la 30 de ani si isi schimba camera in fiecare zi?',
    options: ['Iepurele', 'Veverita', 'Bufnita'],
    correctIndex: 1,
    explanation: 'Veveritele isi construiesc cuiburi multiple in copaci si schimba locul des, sa nu fie prinse de pradatori.',
    minAge: 8,
  },
  {
    prompt: 'De ce isi pierd copacii frunzele toamna?',
    options: ['Se obosesc', 'Sa nu inghete iarna', 'Le mananca animalele'],
    correctIndex: 1,
    explanation: 'Iarna, frunzele ar pierde prea multa apa. Copacii le lasa sa cada si dorm pana primavara.',
    minAge: 8,
  },
  {
    prompt: 'Ciupercile sunt plante, animale sau cu totul altceva?',
    options: ['Plante', 'Animale', 'Altceva'],
    correctIndex: 2,
    explanation: 'Ciupercile au regnul lor — Fungi. Nu fac fotosinteza precum plantele, dar nici nu se misca precum animalele.',
    minAge: 9,
  },
  {
    prompt: 'Care insecta poate ridica de 50 de ori greutatea ei?',
    options: ['Albina', 'Furnica', 'Vrabia'],
    correctIndex: 1,
    explanation: 'Furnicile sunt incredibil de puternice pentru marimea lor — daca ai fi tu asa, ai ridica o masina!',
    minAge: 8,
  },
  {
    prompt: 'Cum face omida sa devina fluture?',
    options: ['Creste aripi din nimic', 'Se transforma complet in coconul ei', 'Inghite o pasare'],
    correctIndex: 1,
    explanation: 'In cocon, omida se "topeste" si se reconstruieste — asta se cheama metamorfoza. Iese fluture in cateva saptamani.',
    minAge: 8,
  },
  {
    prompt: 'Cati pomi planteaza o singura albina lucratoare in timpul vietii ei (prin polenizare)?',
    options: ['Niciunul', 'Cateva sute', 'Mii prin polenizare'],
    correctIndex: 2,
    explanation: 'O albina ajuta mii de plante sa faca seminte. Fara albine, am pierde o treime din toate fructele si legumele.',
    minAge: 9,
  },
  {
    prompt: 'Care e cea mai mare floare din lume?',
    options: ['Trandafirul', 'Rafflesia', 'Floarea-soarelui'],
    correctIndex: 1,
    explanation: 'Rafflesia poate fi mai mare decat o roata de masina. Miroase a carne stricata ca sa atraga mustele care o polenizeaza.',
    minAge: 9,
  },
  {
    prompt: 'Ce gaz daruiesc copacii pe care noi il respiram?',
    options: ['Oxigen', 'Fum', 'Praf'],
    correctIndex: 0,
    explanation: 'Un copac mare produce intr-un an oxigen cat respira 10 oameni. De aia pastram padurile vii.',
  },
  {
    prompt: 'Ursul mananca preponderent...',
    options: ['Carne', 'Plante, fructe si miere', 'Pesti'],
    correctIndex: 1,
    explanation: 'Urșii sunt omnivori si 80-90% din hrana lor sunt plante. Cand le-au crescut zmeurile, devin "vegetarieni" cu zambet pe bot.',
    minAge: 8,
  },
  {
    prompt: 'Care animal de padure are spini pe spate ca aparare?',
    options: ['Vulpea', 'Ariciul', 'Iepurele'],
    correctIndex: 1,
    explanation: 'Ariciul are aproximativ 5.000-7.000 de spini. Cand e speriat, se face ghem si nimeni nu-l mai poate ataca.',
  },
  {
    prompt: 'Cum se cheama partea moale verde de pe pietrele din padure?',
    options: ['Muschi', 'Iarba', 'Spuma'],
    correctIndex: 0,
    explanation: 'Muschiul e o planta foarte simpla, dar a fost printre primele care au cucerit uscatul, acum 470 de milioane de ani.',
  },
  {
    prompt: 'Cati ani poate trai un stejar?',
    options: ['100', '500', 'Peste 1000'],
    correctIndex: 2,
    explanation: 'Unii stejari traiesc peste 1000 de ani. In Anglia exista un stejar "Major Oak" cu peste 1000 de ani, sub care s-ar fi ascuns Robin Hood.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama planta cu spini care creste in desert si pastreaza apa?',
    options: ['Cactus', 'Bambus', 'Trandafir'],
    correctIndex: 0,
    explanation: 'Cactusul saguaro din desertul Sonora poate trai 200 de ani si stoca pana la 4000 de litri de apa in trunchi.',
  },
  {
    prompt: 'Care animal poate dormi pana la 20 de ore pe zi?',
    options: ['Veverita', 'Koala', 'Cerbul'],
    correctIndex: 1,
    explanation: 'Koala doarme atat de mult pentru ca frunzele de eucalipt sunt sarace in energie. Le ia mult sa le digere.',
    minAge: 8,
  },
  {
    prompt: 'Cum se polenizeaza floarea-soarelui — singura sau cu ajutor?',
    options: ['Singura', 'Cu vant', 'Cu albine'],
    correctIndex: 2,
    explanation: 'Albinele care zboara din floare in floare poarta polen. Asa se face samanta care, plantata, da o noua floare.',
    minAge: 8,
  },
  {
    prompt: 'Care animal isi schimba culoarea blanii iarna?',
    options: ['Iepurele de zapada', 'Vulpea rosie', 'Mistretul'],
    correctIndex: 0,
    explanation: 'Iepurele alpin devine alb iarna ca sa se camufleze in zapada. Primavara devine maro din nou.',
    minAge: 8,
  },
  {
    prompt: 'Care paianjenita poate sa traiasca pana la 20 de ani?',
    options: ['Paianjenita-tarantula', 'Paianjenita-cruce', 'Toate paianjenitele'],
    correctIndex: 0,
    explanation: 'Tarantula femela poate trai 20-30 de ani. Masculii traiesc doar 5-10. Au si o pereche de "ochi de noapte".',
    minAge: 9,
  },
  {
    prompt: 'De cand exista bradul pe Pamant (aproximativ)?',
    options: ['10.000 ani', 'Cativa milioane de ani', '300 de milioane de ani'],
    correctIndex: 2,
    explanation: 'Conifere — copaci cu ace — au aparut acum 300 de milioane de ani, inainte ca dinozaurii sa apara. Sunt printre cele mai vechi plante.',
    minAge: 10,
  },
  {
    prompt: 'Cati ani are aproximativ cel mai vechi copac din lume?',
    options: ['1.000', '4.000', 'Peste 5.000'],
    correctIndex: 2,
    explanation: 'Un pin bristlecone din California, "Methuselah", are peste 4800 de ani. Se nascuse cand egiptenii inca construiau piramidele.',
    minAge: 10,
  },
  {
    prompt: 'De ce e bine sa pastram padurile in viata?',
    options: ['Fac oxigen', 'Tin pamantul pe loc', 'Amandoua si multe altele'],
    correctIndex: 2,
    explanation: 'Padurile fac oxigen, tin solul, racoresc planeta, dau casa la mii de specii si curata apa. Sunt plamanii Pamantului.',
  },
];

// ============================================================
// DESERT — curiozitati despre desert si supravietuire
// ============================================================
const DESERT: Q[] = [
  {
    prompt: 'Cati litri de apa poate bea o camila dintr-o singura inghititura?',
    options: ['10', '50', 'Peste 100'],
    correctIndex: 2,
    explanation: 'Cand gaseste apa, camila poate bea peste 100 de litri in cateva minute. Nu le tine in cocoasa, ci in sange.',
    minAge: 9,
  },
  {
    prompt: 'Ce e in cocoasa camilei?',
    options: ['Apa', 'Grasime ca rezerva de hrana', 'Aer'],
    correctIndex: 1,
    explanation: 'Cocoasa e plina cu grasime. Cand camila n-are mancare, isi consuma rezerva si cocoasa se "dezumfla".',
    minAge: 8,
  },
  {
    prompt: 'Care e cel mai mare desert al lumii?',
    options: ['Sahara', 'Antarctica', 'Gobi'],
    correctIndex: 1,
    explanation: 'Antarctica e un desert de gheata — primeste foarte putina ploaie. E mai mare decat Sahara, desi e plina de zapada.',
    minAge: 10,
  },
  {
    prompt: 'De ce e atat de cald in desert ziua, dar atat de frig noaptea?',
    options: ['Vantul si soarele', 'Nisipul nu tine caldura, fara nori', 'E magic'],
    correctIndex: 1,
    explanation: 'Fara umiditate si nori, caldura ziua zboara repede in spatiu noaptea. Diferenta poate fi 40°C intre zi si noapte!',
    minAge: 9,
  },
  {
    prompt: 'Ce vede uneori un calator obosit in desert ca o iluzie?',
    options: ['Lacuri care nu exista', 'Stele cazatoare', 'Curcubeu'],
    correctIndex: 0,
    explanation: 'Mirajul e o iluzie optica — aerul fierbinte deviaza lumina si pare ca vezi apa la distanta. De aici "mirajul oazei".',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama oaza?',
    options: ['Loc cu apa si copaci in desert', 'Munte mare', 'Lac mare'],
    correctIndex: 0,
    explanation: 'In oaza, apa subterana ajunge la suprafata si lasa plantele sa creasca. E ca o insula verde intr-o mare de nisip.',
  },
  {
    prompt: 'Cum se misca dunele de nisip?',
    options: ['Stau pe loc', 'Sunt mutate de vant', 'Se topesc'],
    correctIndex: 1,
    explanation: 'Vantul muta dunele cu cativa centimetri pana cativa metri pe zi. Asa, harta Saharei se schimba mereu.',
    minAge: 8,
  },
  {
    prompt: 'In care planeta din sistemul solar e un desert urias rosu?',
    options: ['Venus', 'Marte', 'Saturn'],
    correctIndex: 1,
    explanation: 'Marte e o lume desertica. Rugina (fier oxidat) din praful ei o face sa para rosie. NASA cauta acolo urme de viata.',
    minAge: 9,
  },
  {
    prompt: 'Care animal de desert isi face sare in ochi cand are nevoie?',
    options: ['Camila', 'Soparla', 'Vulturul'],
    correctIndex: 1,
    explanation: 'Anumite soparle pot "plange" sange ca sa sperie pradatorul sau sa elimine sarea. E mecanism de aparare.',
    minAge: 10,
  },
  {
    prompt: 'In ce stat din SUA se gaseste celebrul "Valea Mortii" cu temperaturi de peste 55°C?',
    options: ['California', 'Texas', 'Florida'],
    correctIndex: 0,
    explanation: 'In Valea Mortii (Death Valley) s-a inregistrat 56,7°C in 1913 — cea mai mare temperatura din lume.',
    minAge: 10,
  },
  {
    prompt: 'Cum se cheama oamenii care traiesc in deserturi si se muta des cu cortul?',
    options: ['Nomazi', 'Pescari', 'Pictori'],
    correctIndex: 0,
    explanation: 'Nomazii din Sahara, "Tuaregi", calatoresc dintr-un loc cu apa in altul. Cunosc desertul ca pe palma lor.',
    minAge: 9,
  },
  {
    prompt: 'Cum produce cactusul saguaro hrana sa, fara frunze?',
    options: ['Cu spinii', 'Cu trunchiul verde, prin fotosinteza', 'Mananca insecte'],
    correctIndex: 1,
    explanation: 'Trunchiul verde al cactusului face fotosinteza in loc de frunze. Spinii sunt frunze modificate care opresc apa sa se evapore.',
    minAge: 9,
  },
  {
    prompt: 'In Sahara, ce animal mare e folosit drept "transport"?',
    options: ['Camila', 'Lupul', 'Crocodilul'],
    correctIndex: 0,
    explanation: 'Camila se numeste "corabia desertului". Poate duce 200 kg si merge zile intregi fara apa.',
  },
  {
    prompt: 'Cum se cheama furtuna mare de nisip din desert?',
    options: ['Sirocco', 'Tornada', 'Tsunami'],
    correctIndex: 0,
    explanation: 'Sirocco e vantul puternic care ridica zile intregi cantitati uriase de nisip. Poate ajunge pana in Europa.',
    minAge: 10,
  },
  {
    prompt: 'Cum supravietuiesc soparlele in desert ziua?',
    options: ['Inoata', 'Se ascund sub piatra, in umbra', 'Mananca foarte mult'],
    correctIndex: 1,
    explanation: 'Soparlele se baga in umbra sau in gauri ziua si ies cand e mai racoare. Asa nu se supraincalzesc.',
  },
  {
    prompt: 'In Star Wars, ce e Tatooine?',
    options: ['O planeta', 'Un robot', 'O nava'],
    correctIndex: 0,
    explanation: 'Tatooine e planeta de desert din Star Wars, casa lui Luke Skywalker. A fost filmata in desertul Tunisiei.',
  },
  {
    prompt: 'Cum se cheama vulpea mica de desert cu urechi enorme?',
    options: ['Vulpea desertica fennec', 'Coiotul', 'Sacalul'],
    correctIndex: 0,
    explanation: 'Fennec are cele mai mari urechi raportat la corp, dintre toate vulpile. Urechile o ajuta sa-si elimine caldura.',
    minAge: 9,
  },
  {
    prompt: 'Cum se imbraca corect cineva care merge prin desert ziua?',
    options: ['Cu haine groase si negre', 'Cu haine largi si deschise la culoare', 'In costum de baie'],
    correctIndex: 1,
    explanation: 'Hainele largi si deschise reflecta soarele. De aceea nomazii din Sahara poarta vesminte traditionale albe sau bej.',
  },
  {
    prompt: 'Care planta de desert "doarme" cativa ani si infloreste dintr-o data dupa o ploaie?',
    options: ['Maciesul', 'Cactusul-floare', 'Brad'],
    correctIndex: 1,
    explanation: 'In deserturi, dupa o ploaie rara, intregul desert poate inflori brusc — semintele asteptau ascunse zeci de ani.',
    minAge: 9,
  },
  {
    prompt: 'Cati sori ai vedea pe cerul Tatooine la apus?',
    options: ['Unul', 'Doi', 'Trei'],
    correctIndex: 1,
    explanation: 'Tatooine e o planeta cu doi sori. In realitate, astronomii au gasit deja peste 100 de planete reale cu doi sori.',
  },
  {
    prompt: 'Cum se cheama partile lite de pe gambe de la camila, ca sa nu se afunde in nisip?',
    options: ['Copite', 'Talpi late', 'Aripi'],
    correctIndex: 1,
    explanation: 'Camila are talpi mari si elastice care se intind pe nisip. Asa nu se afunda — ca niste raschete naturale.',
    minAge: 9,
  },
  {
    prompt: 'Cati ani lipsiti de ploaie poate suporta un cactus?',
    options: ['1 luna', '1 an', 'Cativa ani'],
    correctIndex: 2,
    explanation: 'Cactusii pot supravietui ani de zile fara ploaie, cu apa stocata in trunchi. Cand vine ploaia, beau ca sa o tina pentru viitor.',
    minAge: 9,
  },
];

// ============================================================
// ORAS — curiozitati despre oras, vietuitoare, prietenie
// ============================================================
const ORAS: Q[] = [
  {
    prompt: 'Cati ochi are un caine, pentru a vedea si pe intuneric?',
    options: ['2 ochi normali', '2 ochi cu strat reflector', '4 ochi'],
    correctIndex: 1,
    explanation: 'Cainii au un strat reflector in spatele retinei numit "tapetum lucidum". Asta ii face sa "straluceasca" in lumina si sa vada noaptea.',
    minAge: 9,
  },
  {
    prompt: 'Cati cati copii sunt mai puternici, cei care impart sau cei care nu?',
    options: ['Cei care impart cu prietenii', 'Cei care pastreaza tot', 'Egal'],
    correctIndex: 0,
    explanation: 'Studiile arata ca a impartasi creaza fericire si prieteni — devii mai sigur pe tine cand stii ca cineva tine la tine.',
  },
  {
    prompt: 'In ce mediu sociabil cainele s-a transformat dintr-un lup, acum cati ani?',
    options: ['100 de ani', '1.000 de ani', 'Peste 15.000 de ani'],
    correctIndex: 2,
    explanation: 'Cainii au fost domesticiti din lupi acum 15.000-40.000 de ani. Sunt cel mai vechi prieten al omului.',
    minAge: 9,
  },
  {
    prompt: 'La semafor, ce culoare ne spune sa traversam in siguranta?',
    options: ['Rosu', 'Verde', 'Galben'],
    correctIndex: 1,
    explanation: 'Verde = poti trece. Galben = ai grija, se schimba in rosu. Rosu = stop. Aceleasi reguli in toata lumea.',
  },
  {
    prompt: 'Care numar suni in caz de urgenta in Romania?',
    options: ['100', '112', '911'],
    correctIndex: 1,
    explanation: '112 e numarul unic de urgenta in toata Uniunea Europeana. Functioneaza la ambulanta, pompieri si politie.',
    minAge: 8,
  },
  {
    prompt: 'Cum numim refolosirea hartiei, sticlei si plasticului?',
    options: ['Reciclare', 'Risipa', 'Murdarie'],
    correctIndex: 0,
    explanation: 'O sticla reciclata economiseste energie cat sa tina aprins un bec 4 ore. Reciclarea salveaza planeta.',
  },
  {
    prompt: 'Cum se cheama medicul care are grija de dintii tai?',
    options: ['Dentist', 'Veterinar', 'Optician'],
    correctIndex: 0,
    explanation: 'Dentistul iti curata si repara dintii. Daca te speli pe dinti de 2 ori pe zi, dentistul iti va da steluta.',
  },
  {
    prompt: 'Cum se cheama medicul animalelor?',
    options: ['Veterinar', 'Dentist', 'Pediatru'],
    correctIndex: 0,
    explanation: 'Veterinarul are grija de toate animalele — de la cainele tau pana la un elefant la zoo.',
  },
  {
    prompt: 'Care simt al cainelui e cel mai puternic?',
    options: ['Vazul', 'Mirosul', 'Auzul'],
    correctIndex: 1,
    explanation: 'Cainii au un nas de 10.000 de ori mai sensibil decat al nostru. De aceea ajuta politia si pompierii sa caute oameni.',
  },
  {
    prompt: 'Cum se cheama vehiculul cu sirena care duce bolnavii la spital?',
    options: ['Ambulanta', 'Tren', 'Avion'],
    correctIndex: 0,
    explanation: 'Ambulanta are sirena si lumini puternice ca sa-si faca loc rapid prin trafic. Salveaza vieti in fiecare zi.',
  },
  {
    prompt: 'Care pasare de oras isi face cuibul chiar pe cladiri inalte?',
    options: ['Soimul calator', 'Cocosul', 'Pinguinul'],
    correctIndex: 0,
    explanation: 'Soimul calator e cea mai rapida pasare din lume (peste 300 km/h in cadere). In multe orase isi face cuib pe zgarie-nori.',
    minAge: 9,
  },
  {
    prompt: 'Cati ani trebuie sa ai in Romania ca sa primesti carnet de sofer?',
    options: ['16', '18', '21'],
    correctIndex: 1,
    explanation: 'La 18 ani poti conduce masina. Inainte trebuie sa inveti regulile si sa promovezi un examen.',
    minAge: 8,
  },
  {
    prompt: 'Care e cea mai veche profesie din lume?',
    options: ['Inginer', 'Vanator-culegator', 'Pilot'],
    correctIndex: 1,
    explanation: 'Inainte sa avem orase, oamenii vanau si culegeau hrana. Asa au trait stramosii nostri timp de zeci de mii de ani.',
    minAge: 9,
  },
  {
    prompt: 'De ce reciclam plasticul?',
    options: ['Sa nu polueze oceanele si pamantul', 'Pentru bani', 'E moda'],
    correctIndex: 0,
    explanation: 'Plasticul nu putrezeste sute de ani. In ocean omoara pesti si pasari. Cand reciclam, il facem din nou util.',
  },
  {
    prompt: 'Cum se cheama parcul cu echipamente pentru copii?',
    options: ['Loc de joaca', 'Birou', 'Garaj'],
    correctIndex: 0,
    explanation: 'Locul de joaca are tobogane, leagane, balansoare — toate facute special ca sa te joci in siguranta.',
  },
  {
    prompt: 'Cand un prieten e trist, ce e cel mai bine sa faci?',
    options: ['Sa-l ignori', 'Sa-l asculti si sa-l ajuti', 'Sa razi de el'],
    correctIndex: 1,
    explanation: 'Sa fii alaturi e darul cel mai mare. Un prieten ascultat se simte mai bine, chiar daca nu poti rezolva problema.',
  },
  {
    prompt: 'Capitala Romaniei este...',
    options: ['Cluj', 'Bucuresti', 'Brasov'],
    correctIndex: 1,
    explanation: 'Bucuresti are peste 1,8 milioane de locuitori. E numita "Micul Paris" datorita arhitecturii ei.',
    minAge: 8,
  },
  {
    prompt: 'Care simbol pe ambalaj inseamna ca produsul poate fi reciclat?',
    options: ['Cerc', 'Trei sageti in triunghi', 'Patrat'],
    correctIndex: 1,
    explanation: 'Cele 3 sageti formeaza simbolul reciclarii — ciclu: produs, folosire, reciclare, produs nou.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama persoana care ia foc cu apa si scara?',
    options: ['Pompier', 'Doctor', 'Profesor'],
    correctIndex: 0,
    explanation: 'Pompierii sunt eroi. Pe langa stins focuri, salveaza oameni din ascensoare, scot pisici din copaci si dau prim ajutor.',
  },
  {
    prompt: 'Cum se cheama instrumentul care arata directiile nord, sud, est, vest?',
    options: ['Busola', 'Termometru', 'Cantar'],
    correctIndex: 0,
    explanation: 'Busola se aliniaza cu campul magnetic al Pamantului. Acul ei rosu indica intotdeauna nordul.',
    minAge: 9,
  },
  {
    prompt: 'Cum se transmite zambetul intre prieteni?',
    options: ['Doar prin priviri', 'Si prin priviri, si prin sunet (rasul)', 'Doar prin mesaje'],
    correctIndex: 1,
    explanation: 'Rasul e contagios — creierul nostru e construit sa raspunda la zambete. De aia te simti mai bine cand cineva drag zambeste.',
  },
  {
    prompt: 'Care animal e considerat cel mai bun prieten al omului in tot orasul?',
    options: ['Cainele', 'Pisica', 'Hamsterul'],
    correctIndex: 0,
    explanation: 'Cainii ne ajuta din vechime — protectie, vanatoare, oi, salvari, ghidare a orbilor. De aia se cheama "cel mai bun prieten".',
  },
  {
    prompt: 'Cu cati biti sunt construite calculatoarele si telefoanele?',
    options: ['2 (0 si 1)', '10', '100'],
    correctIndex: 0,
    explanation: 'Computerele "gandesc" doar in 0 si 1 — sistemul binar. Toata Internetul, toate jocurile, sunt facute din astea doua cifre.',
    minAge: 10,
  },
  {
    prompt: 'Cum se cheama partea drumului pentru biciclete?',
    options: ['Pista de biciclete', 'Sosea', 'Trotuar'],
    correctIndex: 0,
    explanation: 'Pista de biciclete e separata de masini ca sa fie sigur. Cand mergi cu bicicleta in oras, pune casca!',
  },
  {
    prompt: 'Care e cel mai mare oras din lume?',
    options: ['Bucuresti', 'New York', 'Tokyo'],
    correctIndex: 2,
    explanation: 'Tokyo are peste 37 de milioane de locuitori in zona metropolitana — mai multi decat are toata Polonia!',
    minAge: 10,
  },
];

// ============================================================
// GENERAL — curiozitati de cultura generala (fallback)
// ============================================================
const GENERAL: Q[] = [
  {
    prompt: 'Cate culori are curcubeul?',
    options: ['5', '7', '10'],
    correctIndex: 1,
    explanation: 'Curcubeul are 7 culori: rosu, oranj, galben, verde, albastru, indigo, violet. Le tii minte cu "ROGVAIV".',
    minAge: 7,
  },
  {
    prompt: 'Cati dinti are un copil de obicei?',
    options: ['20 dinti de lapte', '32', '40'],
    correctIndex: 0,
    explanation: 'Copiii au 20 de dinti de lapte. Apoi cresc 32 de dinti de adult, inclusiv maselele de minte.',
    minAge: 7,
  },
  {
    prompt: 'La cate grade Celsius ingheata apa pura?',
    options: ['0°C', '10°C', '100°C'],
    correctIndex: 0,
    explanation: 'Apa pura ingheata la 0°C si fierbe la 100°C. Apa sarata din ocean ingheata mai jos, la -2°C.',
    minAge: 8,
  },
  {
    prompt: 'Ce iese din amestecul rosu cu albastru?',
    options: ['Verde', 'Mov', 'Portocaliu'],
    correctIndex: 1,
    explanation: 'Rosu + albastru = mov (sau violet). Mov a fost candva cea mai scumpa culoare — doar regii o purtau.',
  },
  {
    prompt: 'Cati ani are un secol?',
    options: ['10', '100', '1000'],
    correctIndex: 1,
    explanation: 'Un secol are 100 de ani. Un mileniu are 1000. Acum traim in al 21-lea secol al erei noastre.',
    minAge: 8,
  },
  {
    prompt: 'Care e cel mai rapid animal pe pamant?',
    options: ['Calul', 'Ghepardul', 'Leul'],
    correctIndex: 1,
    explanation: 'Ghepardul ajunge la 110 km/h in cateva secunde. Insa nu poate alerga mult timp — se supraincalzeste rapid.',
    minAge: 8,
  },
  {
    prompt: 'Care e cel mai mare animal al lumii (vreodata)?',
    options: ['Elefantul african', 'Balena albastra', 'T-Rex'],
    correctIndex: 1,
    explanation: 'Balena albastra are pana la 30 m si 200 de tone. Inima ei singura cantareste cat o masina mica.',
  },
  {
    prompt: 'Care animal nu zboara, dar inoata foarte bine?',
    options: ['Pinguinul', 'Vrabia', 'Bufnita'],
    correctIndex: 0,
    explanation: 'Pinguinii nu zboara prin aer, dar zboara prin apa cu pana la 35 km/h. Aripile lor sunt ca niste vasle.',
  },
  {
    prompt: 'Cum se cheama animalul cu pungă in care isi tine puiul?',
    options: ['Cangurul', 'Iepurele', 'Soarecele'],
    correctIndex: 0,
    explanation: 'Puiul de cangur sta in punguta mamei aproape un an de la nastere. La nastere e cat o cireasa.',
  },
  {
    prompt: 'Cati metri are un kilometru?',
    options: ['100', '1.000', '10.000'],
    correctIndex: 1,
    explanation: 'Un kilometru = 1000 metri. Cea mai apropiata stea, Proxima Centauri, e la 40 trilioane km. Departe...',
    minAge: 8,
  },
  {
    prompt: 'Cati ani are aproximativ Pamantul?',
    options: ['10.000 de ani', 'Cateva milioane de ani', '4,5 miliarde de ani'],
    correctIndex: 2,
    explanation: 'Pamantul s-a format acum 4,5 miliarde de ani. Dinosaurii au aparut tarziu, acum 230 milioane de ani.',
    minAge: 9,
  },
  {
    prompt: 'Cati ochi avem in mod normal?',
    options: ['Doi', 'Trei', 'Patru'],
    correctIndex: 0,
    explanation: 'Doi ochi ne dau perceptia de adancime — fiecare ochi vede putin altfel, iar creierul combina imaginile.',
  },
  {
    prompt: 'Care e instrumentul muzical cu clape albe si negre?',
    options: ['Vioara', 'Pianul', 'Toba'],
    correctIndex: 1,
    explanation: 'Pianul are 88 de clape: 52 albe si 36 negre. Inventat in 1700, are peste 12.000 de piese inauntru.',
    minAge: 8,
  },
  {
    prompt: 'Care continent e cel mai mic ca suprafata?',
    options: ['Australia', 'Europa', 'Antarctica'],
    correctIndex: 0,
    explanation: 'Australia e cel mai mic continent. Are sub 8 milioane km² si e singurul continent care e si tara.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama lumina puternica si rapida din furtuna?',
    options: ['Fulger', 'Stea', 'Soare'],
    correctIndex: 0,
    explanation: 'Fulgerul e mai fierbinte decat suprafata Soarelui. Sunetul lui (tunetul) ajunge la noi mai tarziu pentru ca sunetul e mai incet decat lumina.',
  },
  {
    prompt: 'Care e cea mai lunga tara din lume?',
    options: ['Rusia', 'Chile', 'Canada'],
    correctIndex: 1,
    explanation: 'Chile are peste 4300 km lungime (de la nord la sud), dar e ingusta — in medie doar 175 km lat.',
    minAge: 10,
  },
  {
    prompt: 'Cati timpi are inima omului pe minut, in repaus?',
    options: ['10', '60-80', '200'],
    correctIndex: 1,
    explanation: 'In repaus, inima bate de 60-80 ori pe minut. Cand alergi sau te emotionezi, poate ajunge la 150-200.',
    minAge: 9,
  },
  {
    prompt: 'Cum se cheama animalul cu trompa lunga si urechi mari?',
    options: ['Elefantul', 'Girafa', 'Vaca'],
    correctIndex: 0,
    explanation: 'Elefantul foloseste trompa ca pe o mana — apuca, bea, da fluierat. Si memoreaza fete si locuri ani de zile.',
  },
  {
    prompt: 'Cati ani are un mileniu?',
    options: ['10', '100', '1000'],
    correctIndex: 2,
    explanation: 'Mileniu = 1000 ani. Acum traim in al 3-lea mileniu al erei noastre — incepe in anul 2001.',
    minAge: 9,
  },
  {
    prompt: 'Care e cel mai mare desert tropical?',
    options: ['Sahara', 'Antarctica', 'Gobi'],
    correctIndex: 0,
    explanation: 'Sahara are 9 milioane km², cat SUA. Numele vine din araba si inseamna pur si simplu "desert".',
    minAge: 9,
  },
  {
    prompt: 'Care cifra a fost inventata mai tarziu in matematica?',
    options: ['Zero (0)', 'Unu', 'Sapte'],
    correctIndex: 0,
    explanation: 'Zero a fost inventat in India acum aprox 1500 de ani. Inainte, oamenii pur si simplu nu aveau cum sa scrie "nimic".',
    minAge: 10,
  },
  {
    prompt: 'Cati ani au impreuna toate cele 7 minuni ale lumii antice?',
    options: ['Sute', 'Mii', 'Peste 5000 cumulati'],
    correctIndex: 2,
    explanation: 'Cea mai veche minune, Piramida lui Keops, are aproape 4500 de ani — e singura care s-a pastrat pana azi.',
    minAge: 10,
  },
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
  let updated = 0;
  for (const [domain, list] of Object.entries(BUCKETS)) {
    for (const q of list) {
      const existing = await prisma.journeyQuestion.findFirst({
        where: { domain, prompt: q.prompt },
        select: { id: true },
      });
      const data = {
        domain,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        successLine: q.successLine ?? 'Asa este!',
        failLine: q.failLine ?? 'Nu chiar, dar e bine ca incercam.',
        explanation: q.explanation,
        minAge: q.minAge ?? 6,
        maxAge: q.maxAge ?? 14,
      };
      if (existing) {
        await prisma.journeyQuestion.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.journeyQuestion.create({ data });
        added++;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`seedJourneyQuestions: +${added} adaugate, ${updated} actualizate (cu explicatii)`);
}
