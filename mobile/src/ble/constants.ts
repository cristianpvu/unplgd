// iBeacon Proximity UUID — toate device-urile Unplgd advertise pe acest UUID,
// scanul filtreaza dupa el. Format standard iBeacon (UUID v4 uppercase).
export const UNPLGD_PROXIMITY_UUID = '6E7B9C1F-4A3E-4B2A-9D8C-1234567890AB';

// Identifier unic pentru regiunea iBeacon (folosit de beacon-kit ca id intern).
export const UNPLGD_REGION_IDENTIFIER = 'unplgd-presence';

// Pragul RSSI peste care consideram device-ul "in apropiere" (~5-10m raza).
// Sub asta filtram din scan.
export const RSSI_THRESHOLD_DBM = -80;

// Timp dupa care consideram un device "pierdut" daca nu mai vedem beacon-ul.
export const STALE_AFTER_MS = 30_000;

// Cat de des batch-uim token-urile noi catre backend pt rezolvare.
export const RESOLVE_INTERVAL_MS = 15_000;

// Cat de des reprezentam state-ul catre UI (debounce sub presiunea de scanuri).
export const TICK_INTERVAL_MS = 1_000;

// Pragul pentru un co-walk valid: 10 min de prezenta sustinuta cu acelasi
// prieten (BLE detectat constant in fereastra). Aliniat cu validarea backend
// (POST /interactions/co-walk cere durationSec >= 600).
export const COWALK_MIN_DURATION_MS = 10 * 60 * 1000;

// Cat de mult timp poate "lipsi" un peer fara sa rupem fereastra de co-walk.
// Mai mare ca STALE_AFTER_MS deliberat: peer-ul se sterge din UI dupa 30s
// dar fereastra de co-walk continua daca reapare in <90s (acopera buzunarele
// si interferentele scurte).
export const COWALK_RESUME_GAP_MS = 90_000;

// Anti-cheat: minim de pasi (ai userului curent) in fereastra de co-walk.
// 200 pasi in 10 min = ~150-200m, sub un copil care merge normal in pauza.
// Pragul respinge cazul "telefoanele lasate impreuna pe masa". Identic cu
// pragul aplicat de backend (defense in depth).
export const COWALK_MIN_STEPS = 200;

// Anti-cheat: minim deviation standard al RSSI samples in sesiune. Telefoane
// lipite stationar au RSSI plat (stddev sub 0.5 dBm). Telefoane in miscare
// relativa naturala (corp, obstacole, alti oameni) variaza vizibil.
export const COWALK_MIN_RSSI_STDDEV_DBM = 1.5;

// Cate samples RSSI cerem minim ca sa consideram stddev-ul semnificativ.
// La 1Hz (TICK_INTERVAL_MS) o sesiune de 10 min produce ~600 samples; cerem
// 30 minim ca sa nu validam un walk pe baza unui burst scurt.
export const COWALK_MIN_RSSI_SAMPLES = 30;

// Memory bound pe ring-buffer-ul de samples per sesiune. La 1 sample/sec,
// 1200 = 20 min — depaseste durata minima cu marja confortabila pentru
// sesiuni mai lungi.
export const RSSI_SAMPLES_CAP = 1200;
