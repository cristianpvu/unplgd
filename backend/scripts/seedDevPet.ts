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
  // ElevenLabs voice id (Voice Library, free tier). Override la
  // ELEVENLABS_VOICE_ID din env — daca aceasta valoare e setata pe specie,
  // chat-ul ruleaza ElevenLabs cu vocea asta indiferent de TTS_PROVIDER.
  elevenVoiceId: 'b3j1IRiWblFiHqnXblvH',
  // RVC ramane disabled pe Vader — ElevenLabs cu voce custom suna mai bine
  // si nu costa Replicate. Putem reactiva ulterior daca vrei impersonari mai
  // agresive (combo Eleven → RVC).
  rvcModelUrl: null,
  rvcPitchShift: 0,
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
