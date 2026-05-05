// Dev one-off: ataseaza un pet "Darth Vader" user-ului office@dinedroid.com.
// Ruleaza: npx tsx scripts/seedDevPet.ts
//
// `imagePath` = key GCS pe bucket-ul privat (acelasi folosit de co-creations).
// Backend-ul (routes/pets.ts) genereaza signed URL la fiecare GET /pets/me
// folosind getSignedUrl, deci bucket-ul NU trebuie sa fie public.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'office@dinedroid.com';

const SPECIES = {
  slug: 'darth-vader',
  name: 'Darth Vader',
  voiceId: 'ro-RO-EmilNeural',
  systemHint:
    'Esti Darth Vader, sever dar protector. Vorbesti grav si masurat, cu pauze. Folosesti metafore din spatiu si destin. Nu esti rau cu copilul — il indrumi cu autoritate calma.',
  isDefault: false,
  imagePath: 'pets/PngItem_1495363-removebg-preview.png',
  shortLore: 'Lord-ul Sith devenit prieten — te invata despre putere si echilibru.',
  tone: 'grav, calm, autoritar',
  catchphrases: ['Asa este destinul tau.', 'Forta e cu tine.', 'Respira adanc, tinere.'],
  interests: ['spatiu', 'destin', 'tehnica', 'curaj'],
  minAge: 8,
  unlockLevel: 1,
  // ElevenLabs voice id (Voice Library / Voice Design, free tier). Override la
  // ELEVENLABS_VOICE_ID din env. Pipeline: TTS-ul iese cu aceasta voce, apoi
  // (daca rvcModelUrl e setat) trecem prin RVC pentru nuanta extra.
  elevenVoiceId: 'b3j1IRiWblFiHqnXblvH',
  // RVC overlay: model Vader Ultimate de pe HuggingFace. Pitch -1 (in
  // semitones, via pitch_change_all) ca vocea Eleven sa coboare usor.
  // Setarile RVC sunt blande (vezi voiceConvert.ts) — RVC adauga DOAR
  // distorsiunea / accentul Vader peste vocea Eleven, nu o inlocuieste.
  rvcModelUrl: 'https://huggingface.co/OwlCity/OwlCityRVC/resolve/main/Darth%20Vader%20Ultimate.zip',
  rvcPitchShift: -1,
};

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    throw new Error(`User cu email "${TARGET_EMAIL}" nu exista. Logheaza-te o data in app inainte.`);
  }

  const species = await prisma.petSpecies.upsert({
    where: { slug: SPECIES.slug },
    create: SPECIES,
    update: SPECIES,
  });

  const existingPet = await prisma.pet.findUnique({ where: { userId: user.id } });
  if (existingPet) {
    await prisma.pet.update({
      where: { userId: user.id },
      data: { speciesId: species.id, name: SPECIES.name },
    });
  } else {
    await prisma.pet.create({
      data: { userId: user.id, speciesId: species.id, name: SPECIES.name },
    });
  }

  console.log(`OK: pet "${SPECIES.name}" ataasat user-ului ${TARGET_EMAIL} (id=${user.id}).`);
  console.log(`Image: ${SPECIES.imagePath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
