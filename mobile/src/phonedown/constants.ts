// Praguri sincronizate cu backend-ul. Constantele de baza sunt server-side
// pentru securitate; pe mobil le folosim doar pentru UX (countdown vizual,
// detectie face-down).

// Countdown vizual inainte ca telefonul sa fie cerut jos.
export const PHONE_DOWN_COUNTDOWN_MS = 5000;

// Detectie face-down: pe sensorul DeviceMotion.gravity, axa Z este
// perpendiculara pe ecran. Daca telefonul e cu fata in jos (ecran spre masa),
// gravitatea Z e ~-9.81 m/s² (negativa). Daca e cu fata in sus, +9.81 (pozitiv).
// Folosim un prag generos ca sa permitem inclinari mici (telefonul nu trebuie
// sa fie perfect orizontal pe ecran).
//
// -7.0 = inclinatie aprox > 45° pe spate, suficient ca utilizatorul sa nu vada
// ecranul. Praguri prea stricte irita user-ul cu falsuri.
export const FACE_DOWN_Z_THRESHOLD = -7.0;

// Histeresis: prag mai relaxat la iesirea din face-down ca sa nu fluctueze
// rapid intre states (ex. telefonul lasat pe genunchi cu unghi 50°).
export const FACE_DOWN_Z_RELEASE = -5.0;

// Cat timp trebuie sa fie continuu face-down inainte sa consideram ca "a pus
// telefonul". Filtreaza miscarile tranzitive (intoarsa rapid si inapoi).
export const FACE_DOWN_HOLD_MS = 1500;

// Sample rate sensor — 100ms (10Hz). Ne ajunge — detectia e pe orientare, nu
// pe miscare. Mai mic = consum baterie nejustificat.
export const SENSOR_INTERVAL_MS = 100;
