# Plan AI + Provocari — Unplgd

Document de planificare pentru sistemul AI si provocarile co-creative. Sursa de adevar pentru sesiunea de discutie din 25-26 aprilie 2026. Continuam de aici.

---

## Partea I — Planificare initiala AI

### 1. Tipuri de provocari (versiunea de start)

Cheia: AI-ul **NU** e prietenul de schimb. E un **instigator** care impinge copilul spre interactiuni reale. Asta e si argumentul pentru coordonatoare (anti-screen-time).

**6 tipuri concrete pentru MVP**, sortate dupa cat de bine se aliniaza cu scopul appului:

1. **Provocarea zilei (sociala)** — generata zilnic de AI: *"Intreaba 3 prieteni care e desenul lor preferat si spune-mi"*. Copilul raporteaza in chat → AI valideaza pe text + acorda XP. **Best fit** cu socializarea.
2. **Misiunea "prieten nou"** — *"Saluta un copil cu care nu te-ai mai scanat niciodata"* → validare automata prin NFC checkin (zero friction, hard truth).
3. **Spune o poveste** — AI te ajuta sa construiesti o poveste in chat, apoi provocarea reala e sa o spui unui prieten (validat prin scan + buton "i-am spus-o").
4. **Compliment day** — AI propune sa zici ceva frumos unui prieten anume; prietenul confirma in app. Reciproca = bonding.
5. **Quest exploratie** — *"Gaseste 3 lucruri rotunde si fa-le poza"* → AI vision (Claude vision) valideaza. Singurul care necesita camera. **Respins de Cristian** ca prea superficial — vom face provocari de constructie/desen, nu scavenger hunt.
6. **Duel quiz cu prieten** — Socket.io, AI genereaza intrebari live. Mai mult joc decat socializare, dar copiii il vor cere.

**Recomandarea initiala**: porneste cu 1 + 2 (text + NFC). Cristian a vrut sa mergem mai adanc → vezi Partea II.

### 2. Cum validam — tradeoff principal

Trei modele, in ordine crescand de complexitate:

- **A. Self-report + AI judge** (text). Copilul scrie/povesteste ce a facut, AI judeca + decide accept/retry. Ieftin, demoable in 2 zile. Slabiciune: usor de mintit. **Mitigare**: XP mic, e mai mult feedback pozitiv si educational decat scor.
- **B. Hard validation prin NFC** — zero AI, doar checkin. **Cel mai solid** pt cerinta "interactiune fizica verificata". Asta deja exista.
- **C. Foto + Claude vision** — copilul trimite poza, AI verifica continutul. Wow factor mare la prezentare, dar: cost per request, latency 2-4s, GDPR (poze cu copii), retention.

**Recomandarea**: combina **A + B**. Provocarile NFC-validable → B. Restul → A cu XP mic. Vision intra mai tarziu (vezi Partea II — devine centrala pt build challenges).

### 3. Voce / audio — 3 cai

- **Doar text** — chat tip Messenger. Simplu, ieftin, demoabil. Problema: copilul de 6-7 ani citeste/scrie greu.
- **Text + TTS/STT (hibrid)** — copilul vorbeste (STT pe device cu `@react-native-voice/voice`), AI raspunde text + TTS (`expo-speech` gratis, sau ElevenLabs voce naturala). Bottleneck: latency 3-5s/tura.
- **Voice-to-voice realtime** — OpenAI Realtime API sau Gemini Live. Conversatie ca cu un om, latency <500ms. Problema: ~$0.30/minut, vendor lock, complexitate (websocket, audio streaming).

**Recomandarea pentru licenta**:
- **Faza 1**: text-only (1 saptamana).
- **Faza 2**: TTS pe device cu `expo-speech` (30 min de munca, gratis) — copilul mic poate "asculta" raspunsul fara sa citeasca.
- **Faza 3 (optional)**: STT daca apuci.
- **Faza 4 (demo wow)**: voice-to-voice realtime cu OpenAI Realtime API pe un buton "Vorbeste 1 min cu AI" cu limita stricta. Doar pentru prezentarea orala.

Curba de complexitate naturala in lucrarea scrisa: capitol despre alegerea modelului hibrid vs realtime, cu argumentul cost/latency.

### 4. System prompt strict — punctele cheie

Cerinta coordonatoarei. Top 7 reguli:

1. **Continut age-appropriate** (6-14): fara violenta, sex, droguri, alcool, frica.
2. **Push to offline**: la fiecare ocazie redirectioneaza spre prieten real ("intreaba-l pe Andrei ce parere are").
3. **Anti-stranger-danger educational**: daca apare context de "intalneste pe cineva nou", verifica ca e in scoala/prieten cunoscut.
4. **Refuz teme directe** (calcule/eseuri) — nu inlocuieste scoala. *Discutabil cu coordonatoarea.*
5. **Escalation pe semnale negative** (tristete, abuz, autovatamare) — raspuns standard care indruma spre adult de incredere + flag in DB pt review parental.
6. **Limbaj la nivel** (vocabular simplu, fraze scurte, ton pozitiv, fara ironie).
7. **Limita session** — dupa 15 min propune pauza de la ecran.

**Tehnic**: prompt-ul stocat ca fisier versionat in repo (`backend/src/lib/ai/system-prompt.md`), nu hardcodat in cod, ca sa-l poti rafina + arata in lucrare cu diff-uri.

### 5. Arhitectura tehnica initiala (3 endpoint-uri)

```
POST /ai/chat                    { sessionId, message } -> { reply }
GET  /ai/challenges/today        -> { challenge: {...} }
POST /ai/challenges/:id/submit   { text } -> { accepted, feedback, xpAwarded }
```

- Redis: `ai:session:{userId}` = lista ultimele 20 mesaje, TTL 24h. Resetare zilnica = context fresh, bun pt copii.
- `ai_messages` table in Postgres pt log persistent (audit + lucrare scrisa, "logging conversatii pt analiza").
- Anthropic SDK cu Claude Sonnet 4.6 (raport pret/calitate).
- System prompt prepended la fiecare call, mesajele user/assistant in messages array.

### 6. Ordine de implementare initiala

1. System prompt scris + 5-6 challenge templates in DB (1 zi)
2. `/ai/chat` endpoint + UI chat in `play/ai.tsx` (2-3 zile)
3. `/ai/challenges` endpoint + UI provocari in `play/challenge.tsx` (1-2 zile)
4. TTS pe device cu `expo-speech` (cateva ore)
5. STT cu voice library (1 zi)
6. Optional: vision pt poze, realtime voice pt demo

---

## Partea II — Sesiunea co-creativa (directia aleasa)

**Insight-ul cheie** (Cristian, 26 aprilie): toate ideile bune au aceeasi structura — *intalnire fizica → activitate scaffolded → output co-creat → AI valideaza/sintetizeaza*. O numim **"Sesiune co-creativa"** si o construim ca primitiva centrala. Toate provocarile complexe sunt instante ale ei.

### Primitiva

```
[INTALNIRE]     NFC scan reciproc -> deschide sesiune (proof of meeting)
[CONTEXT]       AI da subiect / regula / tema
[OFFLINE PHASE] Timer pe ambele telefoane, copiii discuta/construiesc fizic
[INPUT PHASE]   UI cere contributie de pe AMBELE device-uri (alternativ, nu paralel)
[AI SYNTHESIS]  Claude proceseaza input + genereaza output partajat
[ARTIFACT]      Output salvat in "galeria comuna" a celor 2 (sau N) copii
[XP]            Recompensa la toti participantii
```

Avem deja NFC + bratari. Adaugam Socket.io + BLE proximity check + camera + Claude vision.

### 4 tipuri concrete pe care le putem livra

#### 1. Co-creation: "Inventati impreuna" (text + AI generative)

**Flow real:**
1. Andrei scaneaza bratara lui Mihai → app intreaba "Sesiune Inventatori?"
2. AI sugereaza 3 teme: "super-erou", "planeta noua", "creatura magica". Mihai alege.
3. **Discussion timer 5 min** — pe ecran apar 5 intrebari ghid ("Cum se numeste?", "Ce putere are?", "Care e slabiciunea ei?"). Niciun input. Doar vorbit.
4. **Construction phase** — 5 sloturi se completeaza **ALTERNATIV** (A face slot 1, B vede live, B face slot 2, etc.). Asta forteaza ca ambii sa fi fost prezenti la discutie.
5. **AI synthesis** — Claude primeste cele 5 sloturi, genereaza:
   - Descriere narativa de paragraf
   - "Card" RPG-style cu stats inventate de el
   - Imagine SVG (DiceBear cu seed unic, sau Stable Diffusion daca avem buget)
   - Citat semnatura ("Eu sunt Zog si vad prin pereti!")
6. **Artifact** salvat in "Cartea noastra" — Andrei + Mihai vad acelasi continut in profilurile lor; alti prieteni il vad ca "creat impreuna de Andrei + Mihai".

**De ce e valid**: NFC = au fost in acelasi loc; alternating input = ambii au contribuit; BLE check pe parcurs = nu s-au separat sa coopteze.

#### 2. Real-world build challenge (vision)

**Flow real:**
1. Sesiune deschisa NFC. AI: *"Aveti 10 minute. Construiti din ce gasiti in jur (lego, hartie, creioane, sticle) un insect-robot cu 6 picioare. Folositi materiale care nu sunt jucarii."*
2. Timer fizic 10 min, copiii construiesc.
3. **Photo phase** — coordonat pe socket: ambii deschid camera simultan, fac poza din **2 unghiuri diferite** (frontal + de sus). App nu lasa sa treci mai departe pana nu vine poza de pe ambele.
4. **Vision validation** — Claude vision primeste cele 2 poze + tema:
   - Coerenta: acelasi obiect din 2 unghiuri? (greu de fakeuit cu 1 poza descarcata)
   - Tema: are 6 picioare? Pare insect-like? Pare facut din materiale de uz comun (nu jucarie kit)?
   - Originalitate: NU pare downloaded de pe internet
5. **AI feedback creativ**: *"Imi place tare aripile facute din capac de iaurt — am vazut detaliul. De ce ati ales 6 picioare in loc de 8 ca o paianjen?"* (intreaba ceva ce CERE ca au gandit la el)
6. Trofeu in galeria comuna + XP.

**De ce e mai puternic decat "gaseste 3 obiecte rotunde"**: cere efort fizic real (10 min de constructie), creativitate, e diferit de fiecare data, AI da feedback specific (nu generic).

#### 3. Lobby multiplayer: "Telefonul desenat" (Pictionary cu twist)

3-6 copii intr-o camera (BLE proximity verifica fizicul + scaneaza un "card de joc" NFC dedicat ca sa intre in lobby).

**Flow:**
- AI = MC. Alege tema secreta ("dragon").
- Tura 1: Andrei deseneaza pe canvas 30s.
- Mihai vede desenul **3 secunde** apoi descrie in 1 propozitie.
- Maria vede doar descrierea si re-deseneaza 30s.
- Cristi vede doar al 2-lea desen si re-descrie.
- ... lant de N pasi.
- La final AI dezvaluie: tema originala, drumul transformarilor, da scor pe creativitate + apropiere fata de original.

**AI roluri**: judge cuvinte (similaritati semantice), narator amuzant la final, posibil generator de tema.

**Wow factor pt prezentare orala enorm**, copiii rad in hohote. Tehnic: Socket.io pt sync, react-native-svg sau react-native-skia pt canvas.

#### 4. Story collab cu turnuri (text + TTS la final)

3+ copii in sesiune.
- AI scrie incipit: *"Intr-o luni dimineata, Marele Caine al Bibliotecii Centrale a descoperit ca toate cartile au inceput sa..."*
- Fiecare copil pe rand adauga 1 propozitie (timer 45s).
- AI moderator: blocheaza lucruri nepotrivite, **da twist** la fiecare 3 propozitii ("Si atunci, deodata, in usa apare..."), tine firul logic.
- Dupa 8 ture, AI scrie finalul + il citeste cu TTS pe toate device-urile.
- Povestea ramane in "biblioteca comuna" a grupului.

Combinata cu pictionary, ai un "evening pack" intreg pentru o reuniune fizica.

### Stack de validare combinata (cum nu pot face cheat)

Pentru fiecare sesiune, layereaza:

| Layer | Ce verifica | Cost |
|---|---|---|
| **NFC scan reciproc la start** | Au fost atins fizic | Gratis (deja avem) |
| **BLE proximity continuu** | Raman aproape > 80% timp | Gratis (e nativ) |
| **Alternating input slots** | Ambii contribuie efectiv | Gratis (UI logic) |
| **Dual photo de pe 2 telefoane** | Acelasi obiect, unghiuri diferite | Gratis |
| **AI cross-check semantic** | Ce spune A se leaga de ce spune B | Cost token Claude |
| **AI vision** | Poza nu e downloaded, corespunde temei | ~$0.005/imagine cu Sonnet |
| **Time-on-task** | Au stat 10 min, nu 30s | Gratis (timer) |

Cand 4-5 din astea pasc, esti **practic sigur**. Pentru licenta, asta e o sectiune de cap intreg in lucrarea scrisa: **"Validare multi-modal a interactiunii fizice"**.

### Ce schimba in arhitectura

```
backend/src/
├── routes/
│   ├── sessions.ts          # POST /sessions/start (NFC handshake)
│   │                        # POST /sessions/:id/input (slot N)
│   │                        # POST /sessions/:id/finalize (AI synthesis)
│   │                        # GET  /sessions/:id (state)
│   └── ai/
│       ├── chat.ts          # libera, fara sesiune
│       ├── synthesis.ts     # Claude calls cu prompt-uri specifice per session type
│       └── vision.ts        # Claude vision pt build challenges
├── lib/
│   ├── socket.ts            # Socket.io server, room = sessionId
│   ├── ai/
│   │   ├── system-prompts/  # markdown files per session type
│   │   ├── synthesizers.ts  # un fn per tip provocare
│   │   └── moderator.ts     # gating system prompt + safety filter
│   └── ble/                 # placeholder, validare proximity facuta clientside

prisma:
  GameSession (id, type, status, startedAt, finalizedAt)
  SessionParticipant (sessionId, userId, joinedAt)
  SessionInput (sessionId, userId, slot, content, kind: text|image)
  SessionArtifact (sessionId, kind: card|story|trophy, payload JSON, imageUrl?)
```

Mobile:
```
app/(app)/play/
├── index.tsx                # meniul deja facut
├── invite.tsx               # asteptare scan NFC pt sesiune
├── session/[id].tsx         # ecran dinamic per tipul sesiunii
└── ai/                      # chat + provocare zilnica (separate de sesiuni)
```

### Ordine sugerata de attack

1. **Saptamana asta**: schema Prisma + endpoint-uri sesiune + flow NFC handshake fara AI (doar deschidere/inchidere sesiune dummy).
2. **Saptamana viitoare**: pattern 1 ("Inventati impreuna") end-to-end cu Claude text. Cel mai simplu si tot impresionant.
3. **Apoi**: pattern 2 (build + vision). Aici inveti Claude vision si demonstrezi multimodal.
4. **Apoi**: Socket.io + pattern 3 sau 4 (multiplayer realtime). Capitolul "realtime" din lucrare.
5. **Polish**: TTS + dashboard galerie comuna.

Asta da **3-4 capitole tehnice solide** in lucrarea scrisa: NFC handshake, AI synthesis cu system prompts, multimodal validation, realtime multiplayer.

---

## Intrebari deschise (de raspuns inainte de schema)

1. **Sesiuni 2-persoane vs N-persoane** — pornim cu doar 2 (mai usor, cele mai multe pattern-uri)? Sau lobby N de la inceput (Socket.io de Day 1)?
2. **Vision pt build challenges** — buget Anthropic ($) sau o lasam pe lista "demo aspirational"? La ~$0.005/sesiune e ieftin daca limitezi la 1-2 challenge-uri/zi/copil.
3. **Galeria comuna** — feature distinct (cu profil shared, vizibil in lista prieteni) merita capitol propriu, sau la inceput tinem artifactele simplu in profilul individual cu tag "creat cu X"?
4. **Storage poze** (pt build challenges) — S3? Cloudflare R2? Local filesystem pe Hetzner cu nginx static? GDPR + retention.
5. **Reactie AI realtime in pictionary** — mesajele de moderare apar instant in lobby sau e batch (la final de tura)? Latency vs cost.
6. **Audio recording in story collab** — ar fi tare ca fiecare copil sa-si inregistreze propozitia (audio), si AI sa faca un "audiobook" cu vocile lor + TTS narrator. Idee adaugata 26.04.

---

## Idei mai libere (dump pt continuare)

- **Ritualuri de inceput de sesiune**: high-five animat pe ecran cand cele 2 telefoane se ating, vibratia haptic e sincronizata pe ambele.
- **Sesiunile reciproc-vizibile**: in profilul tau apare "Andrei a creat 4 lucruri cu tine" — relationship depth visible.
- **"Carnetel comun"** intre 2 copii care se intalnesc des: grow over time, pasaport cu toate sesiunile.
- **AI insights pt parinte/profesor** (cont admin separat, MULT mai tarziu): "Cristi a interactionat cu 5 copii noi luna asta, prefera activitati de constructie".
- **Achievements pe relatii** (nu doar individual): "10 sesiuni cu Andrei", "Prima sesiune cu un coleg nou".
- **Difficulty scaling pe varsta** — copilul de 7 ani primeste 3 sloturi de input simple, cel de 13 primeste 7 sloturi cu prompt-uri mai abstracte.
- **Mod "fara internet"** pt sesiuni offline — doar NFC, validare locala, sync cand revine net. Important pt scoala fara wifi.
- **Anti-burnout**: limita 3 sesiuni co-creative/zi/copil.

---

**Status**: planificare. Nimic implementat inca. Continuam de aici.

---

## Partea III — Decizii 26 aprilie (provocare "Spune o poveste" e PRIMUL feature)

Cristian a ales: **provocarea "Spune o poveste"** e primul AI feature concret. Pet-ul e agentul AI personalizat (unifica "AI buddy" + "pet din NFC card").

### Decizii confirmate

1. **Pet default in DB la register** (NU hardcodat) — seed sau create lazy. Personalizare specie/nume vine in iteratia 2.
2. **Chat conversational pt creare poveste** (nu form-fill).
3. **1 poveste creata/zi/copil**, dar B poate primi N povesti/zi de la prieteni diferiti.
4. **A nu citeste povestea cand o spune lui B** — o povesteste din memorie. Re-reading allowed inainte (in carnetel sau cerand pet-ului) DAR NU in faza de telling cu prietenul de fata.
5. **Inbox "povesti spuse mie azi"** pe ecranul lui B — lista cu prieten + deadline 24h.
6. **Voice in ambele directii**: copilul vorbeste cu pet-ul si pet-ul vorbeste inapoi.

### Flow final "Spune o poveste"

#### Faza 1 — Creare (solo, ~3-5 min)
- Chat conversational cu pet-ul in `play/story/create`
- Pet pune intrebari pe rand: nume erou, ce e, unde e, ce a patit, cum se termina
- Copilul raspunde **prin text SAU voce** (STT)
- Pet citeste cu voce raspunsurile + intrebarea urmatoare (TTS)
- La final, Claude returneaza JSON structurat: `{title, body, keyFacts: [{q, expected}*5]}`
- Povestea finala e citita de pet (TTS), salvata in `Carnetelul meu`
- `keyFacts` raman secret server-side

#### Faza 2 — Telling (cand A intalneste B)
- A apasa "Spune povestea" -> scaneaza bratara lui B (NFC, deja avem)
- Ecran A: "Spune-i lui Mihai povestea ta" + buton "Am terminat" — **FARA text de poveste vizibil**
- Ecran B: "Andrei iti spune o poveste — asculta-l!"
- A o spune din memorie. Apasa "Am terminat" -> creeaza `StoryTelling` cu `expiresAt = now + 24h`
- B primeste push: "Andrei ti-a spus o poveste — intra sa primesti XP!"

#### Faza 3 — Verify (B intra acasa)
- B intra in `play/story/inbox` -> vede lista povesti pending (cu avatar prieten + deadline)
- Tap pe rand -> chat verify cu pet-ul lui (Buddy)
- Pet-ul are in context **doar `keyFacts`**, nu textul integral
- Pet pune cele 5 intrebari pe rand, semantic grading (Claude e indulgent: "pufalina" ≈ "Pufulina")
- Final: score 0-5 + XP awarded conform tabelului

#### XP
| Score | A (povestitor) | B (ascultator) |
|---|---|---|
| 5/5 | 80 | 30 |
| 4/5 | 70 | 25 |
| 3/5 | 60 | 20 |
| 2/5 | 30 | 0 |
| 0-1/5 | 0 | 0 + mesaj "cere-i sa-ti spuna inca o data" |

Bonus +10 daca B verifica in <2h de la telling.

### Voice strategy — 3 etape

#### Etapa A — Voice hibrid simplu (MVP, gratis)
- **TTS**: `expo-speech` (built-in Apple/Google, voci RO native). Pet-ul "vorbeste" raspunsurile + povestea finala.
- **STT**: `@react-native-voice/voice` (modul nativ, dev build deja). Buton mic langa input, vorbesti, transcript → text normal la backend.
- Backend NU stie nimic despre voice. E pure mobile layer.
- **Effort**: ~1 zi.
- **Limitari**: voce robotica, nu personality.

#### Etapa B — Voice premium per pet (post-MVP)
- ElevenLabs TTS cu voce distincta per specie (dragon ragusit, pisica subtire, etc).
- Cost ~$0.30/1000 caractere. Cache audio in S3 (povesti finale TTS-uite o data).
- Limita zilnica per copil.
- **Capitol bun in lucrare**: "Persona vocala distincta pentru agentul AI per copil".

#### Etapa C — Realtime voice (demo prezentare)
- OpenAI Realtime API la un buton special "Vorbeste 1 min cu pet-ul tau".
- Latency <500ms, cost ~$0.30/min, limita 2 min/zi/copil.
- **Optional**, doar pt prezentare orala + comparatie hibrid vs realtime in lucrare.

### Schema Prisma actualizata

```prisma
model Pet {
  id        String   @id @default(cuid())
  userId    String   @unique
  name      String
  species   String   // "buddy", "dragon", "pisica" — catalog seed-uit
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Story {
  id        String   @id @default(cuid())
  authorId  String
  title     String
  body      String   // textul integral, vizibil DOAR autorului
  keyFacts  Json     // [{q, expected}] — secret server-side
  createdAt DateTime @default(now())
  
  author   User           @relation(fields: [authorId], references: [id], onDelete: Cascade)
  tellings StoryTelling[]
  
  @@index([authorId, createdAt])
}

enum StoryTellingStatus { 
  PENDING_VERIFY 
  VERIFIED 
  FAILED 
  EXPIRED 
}

model StoryTelling {
  id          String              @id @default(cuid())
  storyId     String
  listenerId  String              // B
  status      StoryTellingStatus  @default(PENDING_VERIFY)
  toldAt      DateTime            @default(now())
  expiresAt   DateTime
  verifiedAt  DateTime?
  score       Int?                // 0-5
  answers     Json?               // raspunsurile lui B + grading per item
  
  story    Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  listener User  @relation(fields: [listenerId], references: [id], onDelete: Cascade)
  
  @@index([listenerId, status])
  @@index([expiresAt, status])  // pt cleanup job
}
```

`User` capata: `pet Pet?`, `stories Story[]`, `storyTellings StoryTelling[]` (ca listener).

XP via `awardXp` cu sourceType `story_told` (autor) si `story_listened` (listener), `sourceId = tellingId` → idempotent prin unique constraint existent.

### Endpoint-uri

```
POST   /stories                              chat conversational create
       body: { message }
       response: { reply, finalStory?: { id, title, body } }

GET    /stories/mine                         lista povesti create de mine

POST   /stories/:id/tell                     telling cu NFC scan
       body: { listenerBraceletUid }
       response: { tellingId, expiresAt }

GET    /stories/inbox                        povesti spuse mie (active + verificate recent)

POST   /stories/inbox/:tellingId/answer      chat verify
       body: { message }
       response: { reply, done?: true, score?, xpAwarded? }
```

Chat state in Redis: `story:create:{userId}` si `story:verify:{tellingId}`, TTL 1h.

### Mobile screens

```
app/(app)/play/story/
├── index.tsx              # entry: "Creeaza poveste" + "Inbox (3)"
├── create.tsx             # chat creare cu pet-ul + voice
├── mine.tsx               # carnetelul cu povestile mele
├── tell/[id].tsx          # NFC scan + ecran "spune din memorie"
├── inbox.tsx              # lista povesti pending
└── verify/[tellingId].tsx # chat verify cu pet-ul
```

### Ordine de implementare actualizata

1. **Schema + migrare** (Pet, Story, StoryTelling) + create default pet on register — 1h
2. **Backend POST /stories chat** + Anthropic SDK + Redis context + structured JSON output — 4-5h
3. **Mobile `story/create.tsx`** chat UI cu bubbles — 3h
4. **Voice hibrid (Etapa A)**: `expo-speech` TTS + `@react-native-voice/voice` STT — 1 zi
5. **Backend POST /stories/:id/tell** cu NFC validation (reuse logic existent din scan friend) — 2h
6. **Mobile `tell/[id].tsx`** + `mine.tsx` (re-reading) — 3h
7. **Backend inbox + verify chat endpoint** — 4h
8. **Mobile `inbox.tsx` + `verify/[id].tsx`** — 4h
9. **XP wire-up + push notifications** (B primeste push cand A spune povestea) — 2h
10. **Polish + testare end-to-end** — 1 zi

**Total realist: 4-5 zile munca focusata.** Demoabil end-to-end cu voice.

---

## Idei noi (26 aprilie)

- **"Carnetelul de povesti"** intre 2 prieteni — toate povestile spuse intre ei, accesibil din profilul comun.
- **Re-telling**: A poate sa-i spuna aceeasi poveste lui C dupa ce i-a spus lui B (limita: o data/persoana). Repropagare narativa.
- **Story streak**: zile consecutive in care ai creat + spus = bonus crescator (capped la 7).
- **Notification 17:00**: "E ora povestilor! Creeaza una si spune-o unui prieten."
- **Audio recording version (mai tarziu)**: A inregistreaza povestea cand o spune (cu permisiune), AI poate verifica content match. Dar respecta privacy copii.
- **AI illustration la final**: Stable Diffusion / DALL-E genereaza o imagine pentru poveste, salvata in carnetel. Wow factor.

---

## Partea IV — Decizii 26 aprilie (a doua sesiune): NFC dropped, verify e validarea

Cristian a decis: **fara NFC scan in faza de telling**. Copiii sa-si poata povesti random cand se intalnesc, fara sa scoata telefoanele. Validarea se face cand B intra acasa si claim-uieste ca i-a fost spusa povestea.

### Logica noua

```
A: creeaza poveste (1/zi) -> body ramane secret in app, doar A il vede
A si B: se intalnesc fizic random, A povesteste din memorie
B: seara intra in inbox -> tap pe prieten -> chat verify -> XP daca trece
```

**Validarea: chat-ul de verify e el insusi dovada ca B a auzit povestea**. B nu poate ghici 5 detalii specifice (nume personaj inventat, locatie, deznodamant) fara sa fi fost povestit.

### Threat model

- **T1 — B incearca random**: keyFacts inventate de A, imposibil de ghicit, score 0/5, 1 incercare per pereche → blocat dupa fail.
- **T2 — A trimite textul prin WhatsApp lui B**: mitigari soft (1/zi, XP modest 60-80, motivatie intrinseca). Acceptat ca posibil dar improbabil + nu critic.
- **T3 — B incearca toate povestile lui A**: 1 incercare per (story, listener) prin unique constraint. Fail = lock.

**Concluzie**: validarea e SUFICIENTA. In lucrarea scrisa intra in capitolul **"Validare prin proxy semantic AI — alternativa la verificarea hardware"**.

### Ce s-a eliminat din planul anterior

- Endpoint `POST /stories/:id/tell` cu NFC — **dispare**
- Faza 2 cu ecran "spune din memorie" — **dispare**  
- Push notification "Andrei ti-a spus o poveste" — **dispare**
- `play/story/tell/[id].tsx` — **dispare**

### Inbox redesign

```
Cine ti-a povestit azi?
─────────────────────────────────
[avatar] Andrei      poveste noua azi   →
[avatar] Maria       poveste din ieri   →
[avatar] Cristi      poveste alaltaieri →
```

Lista = prieteni care au creat poveste in ultimele 3 zile, neverificate de B inca.

### Schema actualizata (StoryClaim in loc de StoryTelling)

```prisma
model StoryClaim {
  id          String   @id @default(cuid())
  storyId     String
  listenerId  String
  status      StoryClaimStatus @default(ATTEMPTING)
  startedAt   DateTime @default(now())
  verifiedAt  DateTime?
  score       Int?     // 0-5
  answers     Json?
  
  story    Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  listener User  @relation(fields: [listenerId], references: [id], onDelete: Cascade)
  
  @@unique([storyId, listenerId])  // 1 incercare per pereche
  @@index([listenerId, status])
}

enum StoryClaimStatus { ATTEMPTING VERIFIED FAILED }
```

`Story` capata `expiresFromInbox = createdAt + 3 zile` (sau computed at query time).

### Endpoint-uri finale

```
POST  /stories                          chat conversational create (1/zi)
GET   /stories/mine                     carnetelul A
GET   /stories/inbox                    prieteni cu povesti recente neclaimuite de mine
POST  /stories/:storyId/claim           start claim -> creeaza StoryClaim
POST  /stories/claims/:id/answer        chat verify -> grading + XP la final
```

### Mobile screens finale

```
app/(app)/play/story/
├── index.tsx              # entry hub: "Creeaza" + "Inbox (N)"
├── create.tsx             # chat creare cu pet (cu voice hibrid)
├── mine.tsx               # carnetelul cu povestile mele
├── inbox.tsx              # lista prieteni cu povesti recente
└── verify/[claimId].tsx   # chat verify cu pet-ul
```

### Plan de build final

1. Schema + migrare (Pet, Story, StoryClaim) + default pet la register — 1h
2. `POST /stories` chat creare cu Anthropic + Redis context + JSON output structurat — 4-5h
3. `play/story/create.tsx` chat UI — 3h
4. **Voice hibrid (Etapa A)** — `expo-speech` TTS + `@react-native-voice/voice` STT — 1 zi
5. `play/story/mine.tsx` (carnetel re-reading) — 1.5h
6. `GET /stories/inbox` + `play/story/inbox.tsx` — 3h
7. `POST /stories/:id/claim` + `POST /stories/claims/:id/answer` verify chat — 4h
8. `play/story/verify/[id].tsx` — 3h
9. XP wire-up (`story_told` + `story_listened` via `awardXp` idempotent) — 1h
10. Polish + end-to-end testing — 1 zi

**Total: 3-4 zile munca focusata.** (Mai scurt decat varianta NFC.)

### Decizii finale (26 aprilie, sesiunea 3)

1. **Pet default**: caine, **lazy-create in DB la register** (NU hardcodat in cod). Catalog `PetSpecies` seed-uit, default `dog`. Nume si specie editabil mai tarziu (iteratia 2).
2. **Cat ramane povestea in inbox**: 3 zile.
3. **Incercari de claim**: 2 (forgiveness pt typos).
4. **Permisiune microfon**: la onboarding, cu mesaj prietenos.
5. **TTS**: hibrid — vezi sectiunea Voice mai jos.

### Voice strategy finala (hibrid Edge TTS + expo-speech)

Cristian a refuzat varianta robotica si vrea ceva apropiat de ElevenLabs, dar gratis.

**Solutia**: Microsoft Edge TTS server-side pt momentele importante + expo-speech pt replici rapide.

#### Layer 1 — `expo-speech` (device, gratis, instant)
- Folosit pt: replicile pet-ului in chat-ul de creare ("Cum se numeste eroul?")
- Latency 0, fara cost, fara cache
- Voce iOS/Android nativa romana — robotica dar acceptabila pt cuvinte scurte

#### Layer 2 — Microsoft Edge TTS server-side (gratis, neural quality)
- Folosit pt:
  - Povestea finala citita de pet la sfarsitul fazei de creare
  - Intrebarile din chat-ul de verify
- Voci: `ro-RO-EmilNeural` (barbat) sau `ro-RO-AlinaNeural` (femeie)
- API neoficial dar stabil din 2021. Pachet `edge-tts` Python sau echivalent Node
- **Backend**: genereaza MP3, cache pe disk/S3, returneaza URL la mobile
- **Mobile**: `expo-av` sau `react-native-sound` pt playback
- **Cache key**: hash al textului → MP3 refolosit (povesti finale, intrebari standard)

#### Layer 3 — XTTS-v2 voice cloning (post-MVP, capitol lucrare)
- Self-hosted Coqui pe GPU Hetzner (rentat o luna $40 pre-demo)
- Voce clonata distincta per specie pet (urs ragusit, dragon, pisica)
- **Capitol fenomenal in lucrare**: "Voice cloning open-source pentru persona AI per copil"
- NU e dependinta MVP

#### Backup: Google Cloud TTS free tier
- 1M chars/luna Neural2 — suficient pt 50-100 useri demo
- Daca Edge TTS pica vreodata, switchback in 1h

### Schema actualizata cu Pet + Catalog

```prisma
model PetSpecies {
  id          String @id @default(cuid())
  slug        String @unique  // "dog", "cat", "dragon", "robot", "bear"
  name        String          // "Caine", "Pisica", ...
  // Voce default per specie — folosita ca instructie pt TTS server-side
  voiceId     String          // "ro-RO-EmilNeural" pt MVP, voice clone slug post-MVP
  systemHint  String          // ex: "energetic, curios, da labute" — adaugat la system prompt
  isDefault   Boolean @default(false)
  
  pets Pet[]
}

model Pet {
  id        String   @id @default(cuid())
  userId    String   @unique
  speciesId String
  name      String   @default("Buddy")
  createdAt DateTime @default(now())
  
  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  species PetSpecies @relation(fields: [speciesId], references: [id])
}
```

Seed: 1 specie `dog` cu `isDefault=true`, voiceId `ro-RO-EmilNeural`. La register, hook in `auth.ts`: `createDefaultPet(userId)` → cauta default species → creeaza Pet cu `name: "Buddy"`.

### Onboarding update

Dupa register + creare avatar, ecran nou `(auth)/onboarding-pet.tsx`:
- "Hei! Acesta e Buddy, prietenul tau virtual!"
- Animatie / SVG caine cute
- "Buddy iti va vorbi prin telefon — putem sa-i dam voie sa foloseasca microfonul ca sa te poata auzi?"
- Buton "Da" → cere permisiune microfon (`Audio.requestPermissionsAsync()`)
- Continua catre home

### Intrebari ramase

(niciuna critica — pornim coding)


