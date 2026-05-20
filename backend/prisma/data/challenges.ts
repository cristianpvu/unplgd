// Banca de intrebari pentru hunt. Grupate pe `domain` canonic — matching
// pe MonsterTemplate.domain la engage si trigger pt pet hint cand
// PetSpecies.expertiseDomains contine domain-ul.
//
// Slug-uri stabile pt seed idempotent. Existing (q-a69-NNN, q-a14-NNN, c-NNN)
// pastrate pt continuitate cu DB existenta. Adaugare noi = append cu slug
// q-{abbrev}-{age}-{NNN} (abbrev: geo, ist, nat, fch, spt, cor, rom, lit, art,
// mat, teh, vct).
//
// MCQ: exact 4 optiuni, una egala cu expected. Counting: domain="" — sunt
// activitati motoare fara tematica.

export type ChallengeSeed = {
  slug: string;
  type: 'mcq' | 'counting';
  prompt: string;
  expected: string;
  options?: string[];
  ageMin: number;
  ageMax: number;
  domain: string;
  themeTags?: string;
  difficulty?: number;
};

export const CHALLENGES: ChallengeSeed[] = [
  // ============================================================
  // ===== GEOGRAFIE =====
  // ============================================================
  { slug: 'q-a69-001', type: 'mcq', prompt: 'Care e capitala Romaniei?', options: ['Bucuresti', 'Cluj', 'Iasi', 'Brasov'], expected: 'Bucuresti', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-001', type: 'mcq', prompt: 'Pe ce continent se afla Romania?', options: ['Europa', 'Asia', 'Africa', 'America'], expected: 'Europa', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-002', type: 'mcq', prompt: 'In ce tara se afla Turnul Eiffel?', options: ['Italia', 'Franta', 'Spania', 'Anglia'], expected: 'Franta', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-003', type: 'mcq', prompt: 'Cum se numeste planeta pe care traim?', options: ['Marte', 'Venus', 'Pamant', 'Jupiter'], expected: 'Pamant', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-004', type: 'mcq', prompt: 'Care mare se afla langa Romania?', options: ['Marea Mediterana', 'Marea Neagra', 'Marea Baltica', 'Marea Rosie'], expected: 'Marea Neagra', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-005', type: 'mcq', prompt: 'Pe ce continent traieste un cangur?', options: ['Africa', 'Asia', 'Australia', 'America'], expected: 'Australia', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-006', type: 'mcq', prompt: 'Cum se numeste muntele din care erupe lava?', options: ['Deal', 'Vulcan', 'Pestera', 'Stanca'], expected: 'Vulcan', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-007', type: 'mcq', prompt: 'In ce tara se vorbeste italiana?', options: ['Italia', 'Spania', 'Grecia', 'Portugalia'], expected: 'Italia', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-008', type: 'mcq', prompt: 'Cum se numeste o intindere mare de pamant plat?', options: ['Munte', 'Campie', 'Pestera', 'Insula'], expected: 'Campie', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-009', type: 'mcq', prompt: 'In ce tara se afla orasul Tokyo?', options: ['China', 'Japonia', 'Coreea', 'India'], expected: 'Japonia', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-geo-69-010', type: 'mcq', prompt: 'Care e cea mai mare apa sarata?', options: ['Lac', 'Balta', 'Ocean', 'Rau'], expected: 'Ocean', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'geografie' },
  { slug: 'q-a14-004', type: 'mcq', prompt: 'Cate continente are Pamantul?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-005', type: 'mcq', prompt: 'Care e cel mai inalt munte din lume?', options: ['Everest', 'K2', 'Mont Blanc', 'Kilimanjaro'], expected: 'Everest', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-008', type: 'mcq', prompt: 'Care e cel mai lung rau din Romania?', options: ['Olt', 'Mures', 'Dunarea', 'Prut'], expected: 'Dunarea', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-009', type: 'mcq', prompt: 'Care e capitala Frantei?', options: ['Lyon', 'Marsilia', 'Paris', 'Nisa'], expected: 'Paris', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-011', type: 'mcq', prompt: 'Care e cel mai mare ocean din lume?', options: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], expected: 'Pacific', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-015', type: 'mcq', prompt: 'In ce judet se afla Castelul Bran?', options: ['Sibiu', 'Brasov', 'Hunedoara', 'Cluj'], expected: 'Brasov', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-019', type: 'mcq', prompt: 'Care e cel mai inalt varf din Romania?', options: ['Negoiu', 'Moldoveanu', 'Omu', 'Parangu Mare'], expected: 'Moldoveanu', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-020', type: 'mcq', prompt: 'Care e capitala Spaniei?', options: ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'], expected: 'Madrid', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-023', type: 'mcq', prompt: 'Pe ce continent se afla Egiptul?', options: ['Asia', 'Africa', 'Europa', 'America'], expected: 'Africa', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-a14-024', type: 'mcq', prompt: 'Care e capitala Statelor Unite ale Americii?', options: ['New York', 'Washington', 'Los Angeles', 'Chicago'], expected: 'Washington', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-001', type: 'mcq', prompt: 'Pe ce rau este asezat Parisul?', options: ['Sena', 'Loara', 'Rhone', 'Garona'], expected: 'Sena', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-002', type: 'mcq', prompt: 'Pe ce rau este asezat Londra?', options: ['Sena', 'Rin', 'Tamisa', 'Dunarea'], expected: 'Tamisa', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-003', type: 'mcq', prompt: 'Care e cea mai mare tara din lume dupa suprafata?', options: ['China', 'SUA', 'Canada', 'Rusia'], expected: 'Rusia', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-004', type: 'mcq', prompt: 'Pe ce continent se afla Brazilia?', options: ['America de Nord', 'America de Sud', 'Africa', 'Europa'], expected: 'America de Sud', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-005', type: 'mcq', prompt: 'Care e cel mai mare desert cald din lume?', options: ['Gobi', 'Sahara', 'Kalahari', 'Atacama'], expected: 'Sahara', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-006', type: 'mcq', prompt: 'Care e capitala Germaniei?', options: ['Munchen', 'Hamburg', 'Berlin', 'Frankfurt'], expected: 'Berlin', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-007', type: 'mcq', prompt: 'Care e cea mai mare insula din lume?', options: ['Madagascar', 'Groenlanda', 'Borneo', 'Australia'], expected: 'Groenlanda', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-008', type: 'mcq', prompt: 'Care e capitala Greciei?', options: ['Atena', 'Salonic', 'Sparta', 'Patras'], expected: 'Atena', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-009', type: 'mcq', prompt: 'Cum se numeste cea mai lunga catena montana din America de Sud?', options: ['Anzii', 'Rocky', 'Apalasi', 'Atlas'], expected: 'Anzii', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'geografie' },
  { slug: 'q-geo-14-010', type: 'mcq', prompt: 'In ce tara se afla Marele Zid Chinezesc?', options: ['Japonia', 'Coreea', 'China', 'Mongolia'], expected: 'China', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-011', type: 'mcq', prompt: 'Cum se numesc liniile orizontale imaginare de pe glob?', options: ['Meridiane', 'Paralele', 'Tropice', 'Latitudini'], expected: 'Paralele', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'geografie' },
  { slug: 'q-geo-14-012', type: 'mcq', prompt: 'Care e capitala Marii Britanii?', options: ['Manchester', 'Edinburgh', 'Liverpool', 'Londra'], expected: 'Londra', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },
  { slug: 'q-geo-14-013', type: 'mcq', prompt: 'Cum se numeste muntele cu Bucegi din Romania?', options: ['Carpati', 'Apuseni', 'Balcani', 'Alpi'], expected: 'Carpati', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'geografie' },

  // ============================================================
  // ===== ISTORIE =====
  // ============================================================
  { slug: 'q-a14-002', type: 'mcq', prompt: 'In ce an a inceput Al Doilea Razboi Mondial?', options: ['1914', '1918', '1939', '1945'], expected: '1939', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-a14-012', type: 'mcq', prompt: 'Cine a fost domnitorul care a unit Tarile Romane in 1859?', options: ['Mihai Viteazul', 'Stefan cel Mare', 'Alexandru Ioan Cuza', 'Carol I'], expected: 'Alexandru Ioan Cuza', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-69-001', type: 'mcq', prompt: 'Cum se numea conducatorul dacilor invinsi de romani?', options: ['Burebista', 'Decebal', 'Traian', 'Mihai'], expected: 'Decebal', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-002', type: 'mcq', prompt: 'In ce an se sarbatoreste Ziua Romaniei?', options: ['1 decembrie', '24 ianuarie', '1 mai', '15 august'], expected: '1 decembrie', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-003', type: 'mcq', prompt: 'Cum se numeau locuitorii antici ai pamantului Romaniei?', options: ['Romani', 'Dacii', 'Slavii', 'Tracii'], expected: 'Dacii', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-004', type: 'mcq', prompt: 'Cum se numeau razboinicii din nordul cu coif si scuturi?', options: ['Vikingi', 'Romani', 'Greci', 'Egipteni'], expected: 'Vikingi', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-005', type: 'mcq', prompt: 'Cine au construit piramidele celebre?', options: ['Romanii', 'Egiptenii', 'Grecii', 'Chinezii'], expected: 'Egiptenii', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-006', type: 'mcq', prompt: 'Cum se numeau razboinicii Greciei antice?', options: ['Cavaleri', 'Hopliti', 'Samurai', 'Centurioni'], expected: 'Hopliti', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-69-007', type: 'mcq', prompt: 'Cum se imbracau razboinicii in evul mediu?', options: ['In matase', 'In armura', 'In tunici', 'In blana'], expected: 'In armura', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'istorie' },
  { slug: 'q-ist-14-001', type: 'mcq', prompt: 'In ce an a fost Marea Unire de la Alba Iulia?', options: ['1859', '1877', '1918', '1944'], expected: '1918', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-002', type: 'mcq', prompt: 'Cine a fost primul rege al Romaniei?', options: ['Mihai I', 'Ferdinand I', 'Carol I', 'Carol II'], expected: 'Carol I', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-003', type: 'mcq', prompt: 'Cine a fost imparatul roman care a cucerit Dacia?', options: ['Traian', 'Hadrian', 'Cezar', 'Augustus'], expected: 'Traian', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-004', type: 'mcq', prompt: 'In ce an a inceput Primul Razboi Mondial?', options: ['1905', '1914', '1918', '1939'], expected: '1914', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-005', type: 'mcq', prompt: 'Cine a fost prima persoana care a calcat pe Luna?', options: ['Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'John Glenn'], expected: 'Neil Armstrong', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-006', type: 'mcq', prompt: 'Cine a descoperit America in 1492?', options: ['Magellan', 'Vasco da Gama', 'Cristofor Columb', 'Marco Polo'], expected: 'Cristofor Columb', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-007', type: 'mcq', prompt: 'Cum se numea imparatul francez infrant la Waterloo?', options: ['Ludovic XIV', 'Napoleon', 'De Gaulle', 'Robespierre'], expected: 'Napoleon', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-008', type: 'mcq', prompt: 'Cine a fost domnitor al Moldovei intre 1457 si 1504?', options: ['Mihai Viteazul', 'Stefan cel Mare', 'Vlad Tepes', 'Ioan Voda'], expected: 'Stefan cel Mare', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-009', type: 'mcq', prompt: 'In ce an a cazut Zidul Berlinului?', options: ['1985', '1989', '1991', '1995'], expected: '1989', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'istorie' },
  { slug: 'q-ist-14-010', type: 'mcq', prompt: 'Cine a fost domnitor al Tarii Romanesti vestit pentru tepi?', options: ['Mihai Viteazul', 'Stefan cel Mare', 'Vlad Tepes', 'Constantin Brancoveanu'], expected: 'Vlad Tepes', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-011', type: 'mcq', prompt: 'Cine a unit pentru prima data cele trei tari romane in 1600?', options: ['Stefan cel Mare', 'Mihai Viteazul', 'Cuza', 'Decebal'], expected: 'Mihai Viteazul', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'istorie' },
  { slug: 'q-ist-14-012', type: 'mcq', prompt: 'In ce an s-a proclamat Independenta Romaniei?', options: ['1859', '1866', '1877', '1881'], expected: '1877', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'istorie' },

  // ============================================================
  // ===== STIINTE-NATURII =====
  // ============================================================
  { slug: 'q-a69-004', type: 'mcq', prompt: 'Cate picioare are un paianjen?', options: ['6', '8', '10', '4'], expected: '8', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-007', type: 'mcq', prompt: 'In ce anotimp ninge?', options: ['Vara', 'Primavara', 'Toamna', 'Iarna'], expected: 'Iarna', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-008', type: 'mcq', prompt: 'Cine e numit "regele junglei"?', options: ['Tigrul', 'Leul', 'Lupul', 'Ursul'], expected: 'Leul', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-009', type: 'mcq', prompt: 'Cati ochi are o pisica?', options: ['1', '2', '3', '4'], expected: '2', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-012', type: 'mcq', prompt: 'Ce sunet face vaca?', options: ['Miau', 'Cucurigu', 'Muu', 'Hau'], expected: 'Muu', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-018', type: 'mcq', prompt: 'Ce face albina?', options: ['Lapte', 'Miere', 'Branza', 'Unt'], expected: 'Miere', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a69-020', type: 'mcq', prompt: 'Cum se numeste puiul cainelui?', options: ['Catelus', 'Pisoi', 'Pui', 'Manz'], expected: 'Catelus', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-a14-017', type: 'mcq', prompt: 'Cate inimi are o caracatita?', options: ['1', '2', '3', '4'], expected: '3', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'stiinte-naturii' },
  { slug: 'q-a14-025', type: 'mcq', prompt: 'Cum se numeste procesul prin care plantele produc hrana?', options: ['Respiratie', 'Fotosinteza', 'Digestie', 'Evaporare'], expected: 'Fotosinteza', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-001', type: 'mcq', prompt: 'Cum se numeste puiul oii?', options: ['Caine', 'Miel', 'Vitel', 'Mantz'], expected: 'Miel', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-002', type: 'mcq', prompt: 'Cum se numeste casuta albinei?', options: ['Cuib', 'Cusca', 'Stup', 'Borta'], expected: 'Stup', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-003', type: 'mcq', prompt: 'Care animal traieste in apa si pe pamant?', options: ['Caine', 'Broasca', 'Vaca', 'Vulpe'], expected: 'Broasca', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-004', type: 'mcq', prompt: 'Ce mananca girafa?', options: ['Carne', 'Frunze', 'Peste', 'Insecte'], expected: 'Frunze', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-005', type: 'mcq', prompt: 'Care animal hiberneaza iarna?', options: ['Vulpe', 'Veverita', 'Urs', 'Lup'], expected: 'Urs', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-006', type: 'mcq', prompt: 'Care e cel mai mare animal de pe Pamant?', options: ['Elefant', 'Balena albastra', 'Rinocer', 'Girafa'], expected: 'Balena albastra', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-007', type: 'mcq', prompt: 'Cum se numeste o padure cu copaci foarte inalti din zona tropicala?', options: ['Stepa', 'Jungla', 'Pajiste', 'Savana'], expected: 'Jungla', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-008', type: 'mcq', prompt: 'Ce face o omida cand creste?', options: ['Sare', 'Devine fluture', 'Zboara', 'Inoata'], expected: 'Devine fluture', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-009', type: 'mcq', prompt: 'Care e cel mai rapid animal de pe uscat?', options: ['Tigrul', 'Ghepardul', 'Lupul', 'Calul'], expected: 'Ghepardul', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-69-010', type: 'mcq', prompt: 'Cum se numeste apa care cade din nori?', options: ['Roua', 'Bruma', 'Ploaie', 'Ceata'], expected: 'Ploaie', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-001', type: 'mcq', prompt: 'Cum se numeste animalul care isi schimba culoarea?', options: ['Soparla', 'Cameleon', 'Sarpe', 'Broasca testoasa'], expected: 'Cameleon', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-002', type: 'mcq', prompt: 'Cate aripi are o albina?', options: ['2', '4', '6', '8'], expected: '4', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-003', type: 'mcq', prompt: 'In ce regn fac parte ciupercile?', options: ['Plante', 'Animale', 'Fungi', 'Protiste'], expected: 'Fungi', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-004', type: 'mcq', prompt: 'Cum se numeste cel mai mare reptila din lume?', options: ['Aligator american', 'Crocodil marin', 'Soparla Komodo', 'Anaconda'], expected: 'Crocodil marin', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-005', type: 'mcq', prompt: 'Cum se numesc plantele care fac fructe fara flori?', options: ['Angiosperme', 'Gimnosperme', 'Briofite', 'Ferigi'], expected: 'Gimnosperme', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-006', type: 'mcq', prompt: 'Care e cel mai mare ocean predator?', options: ['Delfin', 'Rechin alb', 'Orca', 'Balena ucigasa'], expected: 'Orca', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-007', type: 'mcq', prompt: 'Cati ani poate trai aproximativ un stejar?', options: ['100', '500', '1000', '2000'], expected: '1000', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },
  { slug: 'q-nat-14-008', type: 'mcq', prompt: 'Care e cel mai inalt copac din lume?', options: ['Stejar', 'Brad', 'Sequoia', 'Salcie'], expected: 'Sequoia', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'stiinte-naturii' },

  // ============================================================
  // ===== FIZICA-CHIMIE =====
  // ============================================================
  { slug: 'q-a14-003', type: 'mcq', prompt: 'Care e formula chimica a apei?', options: ['CO2', 'H2O', 'O2', 'NaCl'], expected: 'H2O', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-001', type: 'mcq', prompt: 'Apa fierbinte se transforma in ce?', options: ['Gheata', 'Aburi', 'Zapada', 'Roua'], expected: 'Aburi', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-002', type: 'mcq', prompt: 'Apa la frig se transforma in ce?', options: ['Aburi', 'Gheata', 'Sare', 'Zahar'], expected: 'Gheata', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-003', type: 'mcq', prompt: 'Ce putere ne trage in jos cand sarim?', options: ['Magnetismul', 'Gravitatia', 'Vantul', 'Electricitatea'], expected: 'Gravitatia', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-004', type: 'mcq', prompt: 'Ce material conduce electricitate?', options: ['Lemn', 'Plastic', 'Metal', 'Cauciuc'], expected: 'Metal', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-005', type: 'mcq', prompt: 'Ce culoare are sarea de bucatarie?', options: ['Albastra', 'Galbena', 'Alba', 'Neagra'], expected: 'Alba', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-006', type: 'mcq', prompt: 'Ce ne ajuta sa vedem? Lumina vine de la...', options: ['Pamant', 'Soare', 'Plante', 'Apa'], expected: 'Soare', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-007', type: 'mcq', prompt: 'Ce se intampla cu untul daca-l incalzesti?', options: ['Se intareste', 'Se topeste', 'Se evapora', 'Devine albastru'], expected: 'Se topeste', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-69-008', type: 'mcq', prompt: 'Cum se cheama materialul care atrage fier?', options: ['Magnet', 'Plastic', 'Lemn', 'Carbune'], expected: 'Magnet', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-001', type: 'mcq', prompt: 'Care e simbolul chimic al aurului?', options: ['Au', 'Ag', 'Or', 'Go'], expected: 'Au', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-002', type: 'mcq', prompt: 'Care e simbolul chimic al fierului?', options: ['F', 'Fr', 'Fe', 'Ir'], expected: 'Fe', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-003', type: 'mcq', prompt: 'La cati grade Celsius fierbe apa?', options: ['80', '90', '100', '110'], expected: '100', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-004', type: 'mcq', prompt: 'La cati grade Celsius ingheata apa?', options: ['-5', '0', '5', '10'], expected: '0', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-005', type: 'mcq', prompt: 'Cum se numeste cea mai mica unitate de materie indivizibila chimic?', options: ['Molecula', 'Atom', 'Celula', 'Ion'], expected: 'Atom', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-006', type: 'mcq', prompt: 'Care e unitatea de masura pentru forta?', options: ['Watt', 'Newton', 'Joule', 'Pascal'], expected: 'Newton', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-007', type: 'mcq', prompt: 'Cum se numeste fenomenul prin care lumina se descompune in culori?', options: ['Reflexie', 'Refractie', 'Dispersie', 'Difractie'], expected: 'Dispersie', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-008', type: 'mcq', prompt: 'Cine a formulat legile miscarii?', options: ['Einstein', 'Newton', 'Galileo', 'Tesla'], expected: 'Newton', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },
  { slug: 'q-fch-14-009', type: 'mcq', prompt: 'Care e simbolul chimic al oxigenului?', options: ['Ox', 'O', 'Os', 'On'], expected: 'O', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'fizica-chimie' },

  // ============================================================
  // ===== SPATIU =====
  // ============================================================
  { slug: 'q-a69-011', type: 'mcq', prompt: 'Care e cea mai mare planeta din sistemul solar?', options: ['Pamant', 'Marte', 'Jupiter', 'Venus'], expected: 'Jupiter', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-a14-007', type: 'mcq', prompt: 'Ce planeta e numita "planeta rosie"?', options: ['Marte', 'Jupiter', 'Venus', 'Saturn'], expected: 'Marte', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-a14-016', type: 'mcq', prompt: 'Cum se numeste fenomenul cand Luna acopera Soarele?', options: ['Aurora', 'Eclipsa', 'Cometa', 'Meteorit'], expected: 'Eclipsa', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-69-001', type: 'mcq', prompt: 'Cum se numeste satelitul natural al Pamantului?', options: ['Soare', 'Luna', 'Marte', 'Stea'], expected: 'Luna', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-002', type: 'mcq', prompt: 'Cum se numeste steaua de la centrul sistemului nostru solar?', options: ['Luna', 'Soare', 'Polara', 'Sirius'], expected: 'Soare', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-003', type: 'mcq', prompt: 'Care planeta are inele celebre?', options: ['Marte', 'Venus', 'Saturn', 'Mercur'], expected: 'Saturn', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-004', type: 'mcq', prompt: 'Cum se numeste persoana care merge in spatiu?', options: ['Aviator', 'Astronaut', 'Pilot', 'Marinar'], expected: 'Astronaut', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-005', type: 'mcq', prompt: 'Cum se numeste vehiculul care duce oamenii in spatiu?', options: ['Avion', 'Racheta', 'Vapor', 'Submarin'], expected: 'Racheta', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-006', type: 'mcq', prompt: 'Cum se numeste prima planeta de la Soare?', options: ['Venus', 'Mercur', 'Pamant', 'Marte'], expected: 'Mercur', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-69-007', type: 'mcq', prompt: 'Cum se numeste o stea cazatoare care arde in atmosfera?', options: ['Meteorit', 'Cometa', 'Satelit', 'Galaxie'], expected: 'Meteorit', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'spatiu' },
  { slug: 'q-spt-14-001', type: 'mcq', prompt: 'Cate planete sunt in sistemul nostru solar?', options: ['7', '8', '9', '10'], expected: '8', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-14-002', type: 'mcq', prompt: 'Cum se numeste galaxia noastra?', options: ['Andromeda', 'Calea Lactee', 'Sombrero', 'Triangulum'], expected: 'Calea Lactee', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-14-003', type: 'mcq', prompt: 'Care e cea mai apropiata planeta de Soare?', options: ['Venus', 'Mercur', 'Pamant', 'Marte'], expected: 'Mercur', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-14-004', type: 'mcq', prompt: 'Cine a fost primul om in spatiu?', options: ['Neil Armstrong', 'Yuri Gagarin', 'Buzz Aldrin', 'John Glenn'], expected: 'Yuri Gagarin', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-14-005', type: 'mcq', prompt: 'Care e planeta cea mai indepartata de Soare?', options: ['Uranus', 'Neptun', 'Saturn', 'Pluto'], expected: 'Neptun', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'spatiu' },
  { slug: 'q-spt-14-006', type: 'mcq', prompt: 'Cati ani lumina e distanta de la Soare la cea mai apropiata stea?', options: ['1', '4', '10', '100'], expected: '4', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'spatiu' },
  { slug: 'q-spt-14-007', type: 'mcq', prompt: 'Cum se numeste fenomenul cand Pamantul acopera Luna?', options: ['Eclipsa solara', 'Eclipsa lunara', 'Trecere', 'Aurora'], expected: 'Eclipsa lunara', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },
  { slug: 'q-spt-14-008', type: 'mcq', prompt: 'Cum se numesc rocile din spatiu care cad pe Pamant?', options: ['Asteroizi', 'Meteoriti', 'Comete', 'Sateliti'], expected: 'Meteoriti', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'spatiu' },

  // ============================================================
  // ===== CORP-UMAN =====
  // ============================================================
  { slug: 'q-a14-010', type: 'mcq', prompt: 'Ce gaz respiram pentru a trai?', options: ['Azot', 'Oxigen', 'Hidrogen', 'Dioxid de carbon'], expected: 'Oxigen', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-a14-021', type: 'mcq', prompt: 'Cati cromozomi are o celula umana?', options: ['23', '46', '48', '52'], expected: '46', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'corp-uman' },
  { slug: 'q-cor-69-001', type: 'mcq', prompt: 'Cate degete are o mana?', options: ['4', '5', '6', '10'], expected: '5', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-002', type: 'mcq', prompt: 'Cati ochi are un om?', options: ['1', '2', '3', '4'], expected: '2', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-003', type: 'mcq', prompt: 'Cu ce miros mancarea?', options: ['Limba', 'Nas', 'Urechi', 'Ochi'], expected: 'Nas', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-004', type: 'mcq', prompt: 'Cu ce auzim?', options: ['Limba', 'Nas', 'Urechi', 'Ochi'], expected: 'Urechi', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-005', type: 'mcq', prompt: 'Cum se numeste organul care pompeaza sangele?', options: ['Plamani', 'Inima', 'Stomac', 'Ficat'], expected: 'Inima', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-006', type: 'mcq', prompt: 'Cu ce gustam mancarea?', options: ['Limba', 'Nas', 'Dintii', 'Buze'], expected: 'Limba', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-007', type: 'mcq', prompt: 'Cati dinti are aproximativ un adult?', options: ['20', '28', '32', '40'], expected: '32', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-008', type: 'mcq', prompt: 'Cum se numeste sucul rosu din corpul nostru?', options: ['Apa', 'Sange', 'Suc gastric', 'Lacrimi'], expected: 'Sange', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-009', type: 'mcq', prompt: 'Cum se numesc fructele care au mai multe vitamine C?', options: ['Banane', 'Citrice (portocale, lamai)', 'Mere', 'Pere'], expected: 'Citrice (portocale, lamai)', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-69-010', type: 'mcq', prompt: 'Cati oameni e bine sa dormim?', options: ['2-3 ore', '8-10 ore', '12-14 ore', '20 ore'], expected: '8-10 ore', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'corp-uman' },
  { slug: 'q-cor-14-001', type: 'mcq', prompt: 'Cum se numeste cel mai mare organ al corpului uman?', options: ['Ficat', 'Plamani', 'Piele', 'Creier'], expected: 'Piele', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-cor-14-002', type: 'mcq', prompt: 'Cati litri de sange are in medie un adult?', options: ['2-3', '4-6', '8-10', '12-14'], expected: '4-6', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-cor-14-003', type: 'mcq', prompt: 'Cum se numeste sistemul care lupta cu boli?', options: ['Digestiv', 'Imunitar', 'Nervos', 'Respirator'], expected: 'Imunitar', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-cor-14-004', type: 'mcq', prompt: 'Cum se numeste cel mai dur tesut din corpul uman?', options: ['Os', 'Smaltul dintilor', 'Unghie', 'Par'], expected: 'Smaltul dintilor', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'corp-uman' },
  { slug: 'q-cor-14-005', type: 'mcq', prompt: 'Cate oase are aproximativ un adult?', options: ['100', '150', '206', '300'], expected: '206', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'corp-uman' },
  { slug: 'q-cor-14-006', type: 'mcq', prompt: 'Care e cel mai lung os din corp?', options: ['Tibia', 'Humerus', 'Femur', 'Coloana'], expected: 'Femur', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-cor-14-007', type: 'mcq', prompt: 'Cum se numeste organul prin care respiram?', options: ['Inima', 'Plamani', 'Stomac', 'Ficat'], expected: 'Plamani', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'corp-uman' },
  { slug: 'q-cor-14-008', type: 'mcq', prompt: 'Cati muschi are aproximativ corpul uman?', options: ['200', '400', '600', '1000'], expected: '600', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'corp-uman' },

  // ============================================================
  // ===== LIMBA-ROMANA =====
  // ============================================================
  { slug: 'q-rom-69-001', type: 'mcq', prompt: 'Cate vocale are alfabetul romanesc?', options: ['5', '7', '10', '14'], expected: '7', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-002', type: 'mcq', prompt: 'Care e o vocala?', options: ['B', 'C', 'A', 'D'], expected: 'A', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-003', type: 'mcq', prompt: 'Cum se numeste cuvantul care denumeste o actiune?', options: ['Substantiv', 'Adjectiv', 'Verb', 'Pronume'], expected: 'Verb', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-004', type: 'mcq', prompt: 'Cum se numeste cuvantul care numeste un obiect?', options: ['Verb', 'Substantiv', 'Adjectiv', 'Adverb'], expected: 'Substantiv', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-005', type: 'mcq', prompt: 'Care e pluralul cuvantului "carte"?', options: ['Cartilor', 'Carti', 'Cartoasa', 'Cartule'], expected: 'Carti', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-006', type: 'mcq', prompt: 'Care e pluralul cuvantului "casa"?', options: ['Casele', 'Case', 'Casuri', 'Casuta'], expected: 'Case', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-007', type: 'mcq', prompt: 'Cum se scrie corect: m_re ("fruct rosu")?', options: ['Mare', 'Mere', 'Mar', 'Mura'], expected: 'Mar', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-008', type: 'mcq', prompt: 'Care cuvant e antonim pentru "mare"?', options: ['Imens', 'Mic', 'Gigant', 'Larg'], expected: 'Mic', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-009', type: 'mcq', prompt: 'Care cuvant e antonim pentru "rapid"?', options: ['Iute', 'Sprinten', 'Lent', 'Sustinut'], expected: 'Lent', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-010', type: 'mcq', prompt: 'Care cuvant e antonim pentru "zi"?', options: ['Dimineata', 'Seara', 'Noapte', 'Amiaza'], expected: 'Noapte', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-011', type: 'mcq', prompt: 'Cum se scrie corect numarul 100 in litere?', options: ['Suta', 'O suta', 'Sutaa', 'O suti'], expected: 'O suta', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-69-012', type: 'mcq', prompt: 'Care e diminutivul cuvantului "casa"?', options: ['Casoaie', 'Casuta', 'Casan', 'Casoiul'], expected: 'Casuta', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'limba-romana' },
  { slug: 'q-rom-14-001', type: 'mcq', prompt: 'Care e modul personal al verbului care exprima certitudinea?', options: ['Conjunctiv', 'Conditional', 'Indicativ', 'Imperativ'], expected: 'Indicativ', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-002', type: 'mcq', prompt: 'Cum se numeste cuvantul care insoteste si determina substantivul?', options: ['Verb', 'Adverb', 'Adjectiv', 'Prepozitie'], expected: 'Adjectiv', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-003', type: 'mcq', prompt: 'Care e genul substantivului "carte"?', options: ['Masculin', 'Feminin', 'Neutru', 'Comun'], expected: 'Feminin', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-004', type: 'mcq', prompt: 'Cum se numeste sinonimul cuvantului "trist"?', options: ['Vesel', 'Bucuros', 'Mahnit', 'Calm'], expected: 'Mahnit', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-005', type: 'mcq', prompt: 'Cum se scrie corect: "intr_o casa"?', options: ['intro casa', 'intr-o casa', 'intr o casa', 'intru o casa'], expected: 'intr-o casa', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-006', type: 'mcq', prompt: 'Care e forma corecta de scriere: "nu i", "nu-i", "nui"?', options: ['nu i', 'nu-i', 'nui', 'nu-il'], expected: 'nu-i', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'limba-romana' },
  { slug: 'q-rom-14-007', type: 'mcq', prompt: 'Cum se numeste figura de stil prin care un obiect e numit cu alt nume similar?', options: ['Comparatia', 'Metafora', 'Hiperbola', 'Personificarea'], expected: 'Metafora', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'limba-romana' },
  { slug: 'q-rom-14-008', type: 'mcq', prompt: 'Cum se numeste figura de stil cand obiectele primesc trasaturi de om?', options: ['Metafora', 'Personificare', 'Comparatie', 'Epitet'], expected: 'Personificare', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'limba-romana' },

  // ============================================================
  // ===== LITERATURA =====
  // ============================================================
  { slug: 'q-a69-014', type: 'mcq', prompt: 'Cati pitici are Alba ca Zapada?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-a14-001', type: 'mcq', prompt: 'Cine a scris "Amintiri din copilarie"?', options: ['Mihai Eminescu', 'Ion Creanga', 'I.L. Caragiale', 'Mihail Sadoveanu'], expected: 'Ion Creanga', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-a14-022', type: 'mcq', prompt: 'Cine a scris "Romeo si Julieta"?', options: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jules Verne'], expected: 'William Shakespeare', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-lit-69-001', type: 'mcq', prompt: 'Cum se numeste fata cu papuc de cristal pierdut?', options: ['Frumoasa adormita', 'Cenusareasa', 'Alba ca Zapada', 'Scufita Rosie'], expected: 'Cenusareasa', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-002', type: 'mcq', prompt: 'Cine se intalneste cu lupul in padure?', options: ['Alba ca Zapada', 'Scufita Rosie', 'Cenusareasa', 'Hansel'], expected: 'Scufita Rosie', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-003', type: 'mcq', prompt: 'Cine se trezeste din somn la sarutul printului?', options: ['Cenusareasa', 'Frumoasa adormita', 'Rapunzel', 'Bell'], expected: 'Frumoasa adormita', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-004', type: 'mcq', prompt: 'Cum se numeste eroul din basmul cu trei capre si zmeu?', options: ['Greuceanu', 'Praslea cel Voinic', 'Harap-Alb', 'Fat-Frumos'], expected: 'Praslea cel Voinic', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-005', type: 'mcq', prompt: 'Cum se numeste pisica vorbitoare cu cizme?', options: ['Tom', 'Pisica vorbitoare', 'Motanul Incaltat', 'Garfield'], expected: 'Motanul Incaltat', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-006', type: 'mcq', prompt: 'Cine e baiatul cu nasul lung cand minte?', options: ['Tom Sawyer', 'Pinocchio', 'Peter Pan', 'Aladdin'], expected: 'Pinocchio', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-007', type: 'mcq', prompt: 'Cine a scris "Capra cu trei iezi"?', options: ['Eminescu', 'Creanga', 'Sadoveanu', 'Arghezi'], expected: 'Creanga', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-69-008', type: 'mcq', prompt: 'Cum se numeste autorul povestii "Punguta cu doi bani"?', options: ['Eminescu', 'Ion Creanga', 'I.L. Caragiale', 'Cosbuc'], expected: 'Ion Creanga', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'literatura' },
  { slug: 'q-lit-14-001', type: 'mcq', prompt: 'Cine a scris poemul "Luceafarul"?', options: ['Mihai Eminescu', 'Ion Creanga', 'George Cosbuc', 'Lucian Blaga'], expected: 'Mihai Eminescu', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-lit-14-002', type: 'mcq', prompt: 'Cine a scris "Don Quijote"?', options: ['Cervantes', 'Lope de Vega', 'Garcia Lorca', 'Borges'], expected: 'Cervantes', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'literatura' },
  { slug: 'q-lit-14-003', type: 'mcq', prompt: 'Cine a scris "Harry Potter"?', options: ['J.R.R. Tolkien', 'C.S. Lewis', 'J.K. Rowling', 'Roald Dahl'], expected: 'J.K. Rowling', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-lit-14-004', type: 'mcq', prompt: 'Cine a scris "Stapanul Inelelor"?', options: ['J.K. Rowling', 'J.R.R. Tolkien', 'George R.R. Martin', 'C.S. Lewis'], expected: 'J.R.R. Tolkien', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-lit-14-005', type: 'mcq', prompt: 'Cine a scris "Mioritele"?', options: ['Eminescu', 'Creanga', 'Anonim (popular)', 'Cosbuc'], expected: 'Anonim (popular)', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },
  { slug: 'q-lit-14-006', type: 'mcq', prompt: 'Cum se numeste autorul povestilor cu Pacala?', options: ['Creanga', 'Petre Ispirescu', 'Cosbuc', 'Caragiale'], expected: 'Petre Ispirescu', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'literatura' },
  { slug: 'q-lit-14-007', type: 'mcq', prompt: 'Cine a scris "O scrisoare pierduta"?', options: ['Eminescu', 'Creanga', 'I.L. Caragiale', 'Goga'], expected: 'I.L. Caragiale', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'literatura' },

  // ============================================================
  // ===== ARTA-MUZICA =====
  // ============================================================
  { slug: 'q-a69-005', type: 'mcq', prompt: 'Ce culoare obtii daca amesteci galben cu albastru?', options: ['Verde', 'Portocaliu', 'Maro', 'Roz'], expected: 'Verde', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-a69-015', type: 'mcq', prompt: 'Ce culoare are cerul senin?', options: ['Verde', 'Albastru', 'Roz', 'Galben'], expected: 'Albastru', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-a14-006', type: 'mcq', prompt: 'Cine a pictat "Mona Lisa"?', options: ['Leonardo da Vinci', 'Pablo Picasso', 'Vincent van Gogh', 'Michelangelo'], expected: 'Leonardo da Vinci', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-69-001', type: 'mcq', prompt: 'Ce culoare obtii daca amesteci rosu cu galben?', options: ['Verde', 'Portocaliu', 'Maro', 'Mov'], expected: 'Portocaliu', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-002', type: 'mcq', prompt: 'Ce culoare obtii daca amesteci rosu cu albastru?', options: ['Verde', 'Portocaliu', 'Maro', 'Mov'], expected: 'Mov', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-003', type: 'mcq', prompt: 'Cum se numeste instrumentul cu coarde lovite cu degete?', options: ['Vioara', 'Chitara', 'Pian', 'Tobe'], expected: 'Chitara', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-004', type: 'mcq', prompt: 'Cu ce mainile se canta la pian?', options: ['Una', 'Doua', 'Trei', 'Cu picioarele'], expected: 'Doua', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-005', type: 'mcq', prompt: 'Cum se numeste instrumentul cu arcus?', options: ['Pianul', 'Vioara', 'Trompeta', 'Tobe'], expected: 'Vioara', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-006', type: 'mcq', prompt: 'Cu ce desenam pe hartie de obicei?', options: ['Mancare', 'Creion', 'Apa', 'Sare'], expected: 'Creion', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-69-007', type: 'mcq', prompt: 'Cum se numesc cele trei culori primare?', options: ['Rosu, verde, albastru', 'Rosu, galben, albastru', 'Negru, alb, gri', 'Roz, mov, portocaliu'], expected: 'Rosu, galben, albastru', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'arta-muzica' },
  { slug: 'q-art-14-001', type: 'mcq', prompt: 'Cine a compus "Simfonia a 9-a" cu "Oda Bucuriei"?', options: ['Mozart', 'Beethoven', 'Bach', 'Chopin'], expected: 'Beethoven', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-14-002', type: 'mcq', prompt: 'Cine a pictat "Noaptea instelata"?', options: ['Picasso', 'Van Gogh', 'Monet', 'Dali'], expected: 'Van Gogh', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-14-003', type: 'mcq', prompt: 'Cine a sculptat "David" celebra statuie?', options: ['Rodin', 'Brancusi', 'Michelangelo', 'Bernini'], expected: 'Michelangelo', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-14-004', type: 'mcq', prompt: 'Cine e un sculptor roman celebru?', options: ['Brancusi', 'Picasso', 'Rodin', 'Donatello'], expected: 'Brancusi', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-14-005', type: 'mcq', prompt: 'Cate note muzicale sunt in scara muzicala?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'arta-muzica' },
  { slug: 'q-art-14-006', type: 'mcq', prompt: 'Cine a compus "Mica serenada"?', options: ['Bach', 'Beethoven', 'Mozart', 'Vivaldi'], expected: 'Mozart', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'arta-muzica' },
  { slug: 'q-art-14-007', type: 'mcq', prompt: 'Cine a pictat "Tipatul"?', options: ['Munch', 'Picasso', 'Dali', 'Van Gogh'], expected: 'Munch', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'arta-muzica' },

  // ============================================================
  // ===== MATEMATICA =====
  // ============================================================
  { slug: 'q-a69-002', type: 'mcq', prompt: 'Cate zile are o saptamana?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a69-003', type: 'mcq', prompt: 'Cate luni are un an?', options: ['10', '11', '12', '13'], expected: '12', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a69-006', type: 'mcq', prompt: 'Ce numar urmeaza dupa 99?', options: ['90', '99', '100', '101'], expected: '100', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a69-013', type: 'mcq', prompt: 'Cati metri are un kilometru?', options: ['10', '100', '1000', '10000'], expected: '1000', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a69-016', type: 'mcq', prompt: 'Cati ani are un secol?', options: ['10', '50', '100', '1000'], expected: '100', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a69-019', type: 'mcq', prompt: 'Care e cea mai mica unitate de timp?', options: ['Ora', 'Minutul', 'Secunda', 'Ziua'], expected: 'Secunda', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-a14-014', type: 'mcq', prompt: 'Cat e radacina patrata din 144?', options: ['11', '12', '13', '14'], expected: '12', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-69-001', type: 'mcq', prompt: 'Cat fac 5 + 3?', options: ['7', '8', '9', '10'], expected: '8', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-002', type: 'mcq', prompt: 'Cat fac 10 - 4?', options: ['4', '5', '6', '7'], expected: '6', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-003', type: 'mcq', prompt: 'Cat fac 3 x 4?', options: ['7', '10', '12', '14'], expected: '12', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-004', type: 'mcq', prompt: 'Cat fac 20 : 4?', options: ['4', '5', '6', '8'], expected: '5', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-005', type: 'mcq', prompt: 'Cate ore are o zi?', options: ['12', '20', '24', '36'], expected: '24', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-006', type: 'mcq', prompt: 'Cate minute are o ora?', options: ['30', '50', '60', '100'], expected: '60', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-007', type: 'mcq', prompt: 'Cate secunde are un minut?', options: ['30', '60', '90', '100'], expected: '60', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-008', type: 'mcq', prompt: 'Care numar e par?', options: ['3', '5', '6', '9'], expected: '6', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-009', type: 'mcq', prompt: 'Cate laturi are un triunghi?', options: ['2', '3', '4', '5'], expected: '3', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-69-010', type: 'mcq', prompt: 'Cate laturi are un patrat?', options: ['3', '4', '5', '6'], expected: '4', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'matematica' },
  { slug: 'q-mat-14-001', type: 'mcq', prompt: 'Cat fac 7 x 8?', options: ['54', '56', '58', '64'], expected: '56', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-002', type: 'mcq', prompt: 'Cat fac 144 : 12?', options: ['10', '11', '12', '13'], expected: '12', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-003', type: 'mcq', prompt: 'Cat e perimetrul unui patrat cu latura 5cm?', options: ['10', '15', '20', '25'], expected: '20', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-004', type: 'mcq', prompt: 'Cat e aria unui patrat cu latura 5cm?', options: ['10', '20', '25', '50'], expected: '25', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-005', type: 'mcq', prompt: 'Cat fac 2 la puterea 5?', options: ['16', '25', '32', '64'], expected: '32', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-006', type: 'mcq', prompt: 'Care e cifra romana pentru 5?', options: ['IV', 'V', 'VI', 'X'], expected: 'V', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-007', type: 'mcq', prompt: 'Care e cifra romana pentru 50?', options: ['L', 'C', 'D', 'M'], expected: 'L', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'matematica' },
  { slug: 'q-mat-14-008', type: 'mcq', prompt: 'Cat e pi cu 2 zecimale?', options: ['3.10', '3.14', '3.21', '3.41'], expected: '3.14', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-009', type: 'mcq', prompt: 'Cat e suma unghiurilor unui triunghi (in grade)?', options: ['90', '180', '270', '360'], expected: '180', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },
  { slug: 'q-mat-14-010', type: 'mcq', prompt: 'Cati centimetri are un metru?', options: ['10', '100', '1000', '10000'], expected: '100', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'matematica' },

  // ============================================================
  // ===== TEHNOLOGIE =====
  // ============================================================
  { slug: 'q-a14-018', type: 'mcq', prompt: 'Cine a inventat becul electric?', options: ['Nikola Tesla', 'Thomas Edison', 'Albert Einstein', 'Isaac Newton'], expected: 'Thomas Edison', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-69-001', type: 'mcq', prompt: 'Cum se numeste aparatul care sterge praful?', options: ['Frigider', 'Aspirator', 'Cuptor', 'Spalator'], expected: 'Aspirator', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-69-002', type: 'mcq', prompt: 'Cu ce vorbim cu cineva departe?', options: ['Carte', 'Telefon', 'Caiet', 'Floare'], expected: 'Telefon', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-69-003', type: 'mcq', prompt: 'Cu ce vehicul zboara oamenii prin aer?', options: ['Vapor', 'Avion', 'Tren', 'Camion'], expected: 'Avion', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-69-004', type: 'mcq', prompt: 'Cum se numeste aparatul care ne arata filme acasa?', options: ['Telefon', 'Radio', 'Televizor', 'Frigider'], expected: 'Televizor', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-69-005', type: 'mcq', prompt: 'Cum se numeste aparatul care raceste mancarea?', options: ['Cuptor', 'Frigider', 'Aspirator', 'Microunde'], expected: 'Frigider', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-69-006', type: 'mcq', prompt: 'Cu ce ne conectam la internet?', options: ['Foarfeca', 'Calculator', 'Furculita', 'Lingura'], expected: 'Calculator', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'tehnologie' },
  { slug: 'q-teh-14-001', type: 'mcq', prompt: 'Cine a inventat telefonul?', options: ['Edison', 'Bell', 'Tesla', 'Marconi'], expected: 'Bell', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-14-002', type: 'mcq', prompt: 'Cum se numeste creierul unui calculator?', options: ['RAM', 'CPU', 'HDD', 'GPU'], expected: 'CPU', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-14-003', type: 'mcq', prompt: 'Cum se numeste reteaua mondiala de calculatoare?', options: ['LAN', 'WiFi', 'Internet', 'Bluetooth'], expected: 'Internet', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-14-004', type: 'mcq', prompt: 'Cine a fondat Microsoft?', options: ['Steve Jobs', 'Bill Gates', 'Mark Zuckerberg', 'Elon Musk'], expected: 'Bill Gates', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-14-005', type: 'mcq', prompt: 'Cine a fondat Apple?', options: ['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Larry Page'], expected: 'Steve Jobs', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },
  { slug: 'q-teh-14-006', type: 'mcq', prompt: 'Cum se numeste tehnologia de plata fara contact intre telefoane?', options: ['WiFi', 'NFC', 'GPS', 'IR'], expected: 'NFC', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'tehnologie' },
  { slug: 'q-teh-14-007', type: 'mcq', prompt: 'Cati bytes are un kilobyte?', options: ['100', '1000', '1024', '10000'], expected: '1024', ageMin: 10, ageMax: 14, difficulty: 3, domain: 'tehnologie' },
  { slug: 'q-teh-14-008', type: 'mcq', prompt: 'Cum se numeste limbajul de programare popular pentru web?', options: ['Python', 'JavaScript', 'C++', 'Ruby'], expected: 'JavaScript', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'tehnologie' },

  // ============================================================
  // ===== VIATA-COTIDIANA =====
  // ============================================================
  { slug: 'q-a69-010', type: 'mcq', prompt: 'Cum se numeste casuta cainelui?', options: ['Cuibul', 'Cusca', 'Petera', 'Borta'], expected: 'Cusca', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-a69-017', type: 'mcq', prompt: 'Cate roti are o bicicleta?', options: ['1', '2', '3', '4'], expected: '2', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-a14-013', type: 'mcq', prompt: 'Cati km are aproximativ un maraton?', options: ['21', '32', '42', '50'], expected: '42', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-001', type: 'mcq', prompt: 'La ce culoare a semaforului trecem strada?', options: ['Rosu', 'Galben', 'Verde', 'Albastru'], expected: 'Verde', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-002', type: 'mcq', prompt: 'Pe ce ne deplasam prin oras cand luminile sunt rosii?', options: ['Trecem strada', 'Stam pe loc', 'Alergam', 'Sarim'], expected: 'Stam pe loc', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-003', type: 'mcq', prompt: 'Cu ce taiem painea?', options: ['Lingura', 'Furculita', 'Cutit', 'Pahar'], expected: 'Cutit', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-004', type: 'mcq', prompt: 'Cu ce mancam supa?', options: ['Lingura', 'Furculita', 'Cutit', 'Mana'], expected: 'Lingura', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-005', type: 'mcq', prompt: 'Cu ce ne spalam pe dinti?', options: ['Sapun', 'Periuta si pasta', 'Apa', 'Servet'], expected: 'Periuta si pasta', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-006', type: 'mcq', prompt: 'Cum se numeste persoana care vinde paine?', options: ['Doctor', 'Brutar', 'Profesor', 'Pompier'], expected: 'Brutar', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-007', type: 'mcq', prompt: 'Cum se numeste persoana care stinge focul?', options: ['Pompier', 'Medic', 'Profesor', 'Politist'], expected: 'Pompier', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-008', type: 'mcq', prompt: 'Cum se numeste persoana care ne ingrijeste cand suntem bolnavi?', options: ['Pompier', 'Politist', 'Doctor', 'Brutar'], expected: 'Doctor', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-009', type: 'mcq', prompt: 'Cum se numeste numarul de urgenta in Romania?', options: ['100', '111', '112', '999'], expected: '112', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-69-010', type: 'mcq', prompt: 'Ce e bine sa faci la dentist?', options: ['Sa fugi', 'Sa stai linistit', 'Sa tipi', 'Sa plangi'], expected: 'Sa stai linistit', ageMin: 6, ageMax: 9, difficulty: 1, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-001', type: 'mcq', prompt: 'Cati lei e o suta de bani?', options: ['1', '10', '100', '1000'], expected: '1', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-002', type: 'mcq', prompt: 'Cum se numeste obtinerea apei calde din apa rece?', options: ['Inghet', 'Fierbere', 'Incalzire', 'Topire'], expected: 'Incalzire', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-003', type: 'mcq', prompt: 'Cum se numeste banca care se ocupa cu banii Romaniei?', options: ['BCR', 'BNR (Banca Nationala)', 'BRD', 'ING'], expected: 'BNR (Banca Nationala)', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-004', type: 'mcq', prompt: 'Cum se numeste documentul cu care identificam o persoana?', options: ['Bilet', 'Carte de identitate', 'Cec', 'Factura'], expected: 'Carte de identitate', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-005', type: 'mcq', prompt: 'In Romania moneda nationala se numeste...', options: ['Euro', 'Dolar', 'Leu', 'Forint'], expected: 'Leu', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-006', type: 'mcq', prompt: 'Cum se numeste sportul cu mingea ovala si echipe de 15?', options: ['Fotbal', 'Rugby', 'Tenis', 'Baschet'], expected: 'Rugby', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-007', type: 'mcq', prompt: 'Cati jucatori are o echipa de fotbal pe teren?', options: ['9', '10', '11', '12'], expected: '11', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },
  { slug: 'q-vct-14-008', type: 'mcq', prompt: 'Cati ani trebuie sa ai ca sa votezi in Romania?', options: ['16', '17', '18', '21'], expected: '18', ageMin: 10, ageMax: 14, difficulty: 2, domain: 'viata-cotidiana' },

  // ============================================================
  // ===== COUNTING (fara domain — activitate motoare) =====
  // ============================================================
  { slug: 'c-001', type: 'counting', prompt: 'Atinge ecranul de exact 5 ori', expected: '5', ageMin: 6, ageMax: 14, difficulty: 1, domain: '' },
  { slug: 'c-002', type: 'counting', prompt: 'Atinge ecranul de exact 7 ori', expected: '7', ageMin: 6, ageMax: 14, difficulty: 1, domain: '' },
  { slug: 'c-003', type: 'counting', prompt: 'Atinge ecranul de exact 10 ori', expected: '10', ageMin: 6, ageMax: 14, difficulty: 1, domain: '' },
  { slug: 'c-004', type: 'counting', prompt: 'Atinge ecranul de exact 12 ori', expected: '12', ageMin: 8, ageMax: 14, difficulty: 2, domain: '' },
  { slug: 'c-005', type: 'counting', prompt: 'Atinge ecranul de exact 8 ori', expected: '8', ageMin: 6, ageMax: 14, difficulty: 1, domain: '' },
  { slug: 'c-006', type: 'counting', prompt: 'Atinge ecranul de exact 15 ori', expected: '15', ageMin: 9, ageMax: 14, difficulty: 2, domain: '' },
  { slug: 'c-007', type: 'counting', prompt: 'Atinge ecranul de exact 3 ori', expected: '3', ageMin: 6, ageMax: 9, difficulty: 1, domain: '' },
  { slug: 'c-008', type: 'counting', prompt: 'Atinge ecranul de exact 6 ori', expected: '6', ageMin: 6, ageMax: 14, difficulty: 1, domain: '' },
];
