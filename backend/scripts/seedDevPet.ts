// Dev one-off: ataseaza un pet "Darth Vader" user-ului office@dinedroid.com.
// Ruleaza: npx tsx scripts/seedDevPet.ts
//
// Nota: URL-ul GCS public e "https://storage.googleapis.com/<bucket>/<path>"
// (NU "storage.cloud.google.com" care necesita login Google in browser).
// Obiectul trebuie sa aiba allUsers:objectViewer ca Image-ul din mobile sa-l
// poata incarca anonim.

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
  imagePath: 'https://storage.googleapis.com/unplgd/pets/PngItem_1495363-removebg-preview.png',
  shortLore: 'Lord-ul Sith devenit prieten — te invata despre putere si echilibru.',
  tone: 'grav, calm, autoritar',
  catchphrases: ['Asa este destinul tau.', 'Forta e cu tine.', 'Respira adanc, tinere.'],
  interests: ['spatiu', 'destin', 'tehnica', 'curaj'],
  minAge: 8,
  unlockLevel: 1,
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
