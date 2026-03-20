import { PrismaClient, GlobalRole, FieldType, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const ROUNDS = 12;

  // 1. Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@checkflow.local' },
    update: {},
    create: {
      email: 'admin@checkflow.local',
      passwordHash: await bcrypt.hash('Admin1234!', ROUNDS),
      firstName: 'Super',
      lastName: 'Admin',
      role: GlobalRole.SUPER_ADMIN,
    },
  });

  const gestionnaire = await prisma.user.upsert({
    where: { email: 'gestionnaire@checkflow.local' },
    update: {},
    create: {
      email: 'gestionnaire@checkflow.local',
      passwordHash: await bcrypt.hash('Gest1234!', ROUNDS),
      firstName: 'Marie',
      lastName: 'Gestionnaire',
      role: GlobalRole.ADMIN,
    },
  });

  const accueil = await prisma.user.upsert({
    where: { email: 'accueil@checkflow.local' },
    update: {},
    create: {
      email: 'accueil@checkflow.local',
      passwordHash: await bcrypt.hash('Acc1234!', ROUNDS),
      firstName: 'Jean',
      lastName: 'Accueil',
      role: GlobalRole.OPERATOR,
    },
  });

  const observateur = await prisma.user.upsert({
    where: { email: 'observateur@checkflow.local' },
    update: {},
    create: {
      email: 'observateur@checkflow.local',
      passwordHash: await bcrypt.hash('Obs1234!', ROUNDS),
      firstName: 'Paul',
      lastName: 'Observateur',
      role: GlobalRole.VIEWER,
    },
  });

  // 2. Event
  const event = await prisma.event.upsert({
    where: { slug: 'conseil-municipal' },
    update: {},
    create: {
      slug: 'conseil-municipal',
      title: 'Conseil Municipal',
      subtitle: 'Installation du conseil municipal',
      logoEmoji: '\u{1F3DB}\u{FE0F}',
      entitySingular: '\u00e9lu',
      entityPlural: '\u00e9lus',
      displayNameTpl: '{prenom} {nom}',
      searchFields: ['nom', 'prenom'],
    },
  });

  // 3. FieldDefs
  const fieldDefs = [
    { key: 'civilite', label: 'Civilit\u00e9', type: FieldType.SELECT, options: ['M.', 'Mme', 'Autre'], displayOrder: 0 },
    { key: 'nom', label: 'Nom', type: FieldType.TEXT, required: true, displayInList: true, displayOrder: 1 },
    { key: 'prenom', label: 'Pr\u00e9nom', type: FieldType.TEXT, required: true, displayInList: true, displayOrder: 2 },
    { key: 'date_naissance', label: 'Date de naissance', type: FieldType.DATE, displayOrder: 3 },
    { key: 'commune', label: 'Commune', type: FieldType.TEXT, displayInList: true, displayOrder: 4 },
    { key: 'groupe_politique', label: 'Groupe politique', type: FieldType.TEXT, displayInList: true, displayOrder: 5 },
    { key: 'email', label: 'Email', type: FieldType.EMAIL, isEmailField: true, displayOrder: 6 },
    { key: 'telephone', label: 'T\u00e9l\u00e9phone', type: FieldType.TEL, displayOrder: 7 },
    { key: 'qr_code', label: 'Code QR', type: FieldType.TEXT, required: true, isQrField: true, editable: false, displayOrder: 8 },
  ];

  for (const fd of fieldDefs) {
    await prisma.fieldDef.upsert({
      where: { eventId_key: { eventId: event.id, key: fd.key } },
      update: {},
      create: {
        eventId: event.id,
        key: fd.key,
        label: fd.label,
        type: fd.type,
        options: fd.options || [],
        required: fd.required || false,
        displayInList: fd.displayInList || false,
        displayOrder: fd.displayOrder,
        isQrField: fd.isQrField || false,
        isEmailField: fd.isEmailField || false,
        editable: fd.editable !== undefined ? fd.editable : true,
      },
    });
  }

  // 4. DocumentDefs (multi-documents)
  // Delete existing docs for this event to avoid duplicates on re-seed
  await prisma.documentDef.deleteMany({ where: { eventId: event.id } });

  const doc1 = await prisma.documentDef.create({
    data: {
      eventId: event.id,
      title: 'Consentement RGPD',
      signingLabel: 'Signer le consentement',
      declarationTemplate:
        'Je soussign\u00e9(e) {{prenom}} {{nom}}, d\u00e9clare avoir pris connaissance des informations ci-dessus relatives au traitement de mes donn\u00e9es personnelles par la Mairie de Saint-Paul et consens \u00e0 leur traitement dans le cadre du Conseil Municipal.',
      noticeSections: JSON.parse(
        JSON.stringify([
          {
            title: 'Responsable du traitement',
            content:
              'La Mairie de Saint-Paul, repr\u00e9sent\u00e9e par son Maire, est responsable du traitement de vos donn\u00e9es personnelles.',
          },
          {
            title: 'Finalit\u00e9s du traitement',
            content:
              'Vos donn\u00e9es sont collect\u00e9es pour la gestion administrative du Conseil Municipal, le suivi des pr\u00e9sences et la g\u00e9n\u00e9ration des documents officiels.',
          },
          {
            title: 'Base l\u00e9gale',
            content:
              'Le traitement est fond\u00e9 sur l\u2019obligation l\u00e9gale (article 6.1.c du RGPD) et l\u2019ex\u00e9cution d\u2019une mission d\u2019int\u00e9r\u00eat public (article 6.1.e du RGPD).',
          },
          {
            title: 'Dur\u00e9e de conservation',
            content:
              'Les donn\u00e9es sont conserv\u00e9es pendant la dur\u00e9e du mandat et archiv\u00e9es conform\u00e9ment aux obligations l\u00e9gales.',
          },
          {
            title: 'Vos droits',
            content:
              'Vous disposez des droits d\u2019acc\u00e8s, de rectification, d\u2019effacement, de limitation, de portabilit\u00e9 et d\u2019opposition. Pour exercer ces droits, contactez le DPO de la Mairie de Saint-Paul \u00e0 dpo@mairie-saintpaul.re.',
          },
        ]),
      ),
      pdfFooterText:
        'Document g\u00e9n\u00e9r\u00e9 \u00e9lectroniquement par CheckFlow pour la Mairie de Saint-Paul \u2013 Ce document a valeur de preuve de consentement.',
      signatureWidthMm: 75,
      signatureHeightMm: 28,
      displayOrder: 0,
      required: true,
    },
  });

  await prisma.documentDef.create({
    data: {
      eventId: event.id,
      title: 'Charte de l\'elu',
      signingLabel: 'Signer la charte',
      declarationTemplate:
        'Je soussigne(e) {prenom} {nom}, m\'engage a respecter la charte de l\'elu local et a exercer mon mandat dans le respect des principes de probite, de transparence et de neutralite.',
      noticeSections: JSON.parse(JSON.stringify([
        {
          title: 'Objet de la charte',
          content: 'La presente charte definit les engagements ethiques et deontologiques des elus du Conseil Municipal de Saint-Paul.',
        },
        {
          title: 'Engagements',
          content: 'L\'elu s\'engage a : exercer son mandat avec dignite et integrite, respecter le principe de laicite, prevenir les situations de conflit d\'interets, faire preuve d\'assiduite aux seances du conseil.',
        },
      ])),
      pdfFooterText: 'Charte de l\'elu — Mairie de Saint-Paul',
      signatureWidthMm: 75,
      signatureHeightMm: 28,
      displayOrder: 1,
      required: true,
    },
  });

  // 5. EmailConfig (global — singleton)
  const existingEmail = await prisma.emailConfig.findFirst();
  if (!existingEmail) {
    await prisma.emailConfig.create({
      data: {
        smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'noreply@mairie-saintpaul.re',
      smtpPass: 'PLACEHOLDER_ENCRYPTED_PASSWORD',
      fromAddress: 'noreply@mairie-saintpaul.re',
      fromName: 'Mairie de Saint-Paul',
      autoSendOnSign: false,
      allowManualSend: true,
      subject: 'Votre document sign\u00e9 \u2013 Conseil Municipal',
      bodyTemplate:
        '<p>Bonjour {{participantName}},</p><p>Veuillez trouver ci-joint vos documents signes.</p><p>Cordialement,<br>{{organizationName}}</p>',
      },
    });
  }

  // 6. Participants
  const participants = [
    { civilite: 'M.', nom: 'Hoarau', prenom: 'Jean-Pierre', date_naissance: '1965-03-15', commune: 'Saint-Paul', groupe_politique: 'Majorit\u00e9 municipale', email: 'jp.hoarau@example.re', telephone: '0692010101', qr_code: 'QR-ELU001' },
    { civilite: 'Mme', nom: 'Dijoux', prenom: 'Marie-Claire', date_naissance: '1972-07-22', commune: 'La Plaine Saint-Paul', groupe_politique: 'Majorit\u00e9 municipale', email: 'mc.dijoux@example.re', telephone: '0692020202', qr_code: 'QR-ELU002' },
    { civilite: 'M.', nom: 'Grondin', prenom: 'Thierry', date_naissance: '1980-11-05', commune: 'Saint-Gilles-les-Bains', groupe_politique: 'Opposition', email: 't.grondin@example.re', telephone: '0692030303', qr_code: 'QR-ELU003' },
    { civilite: 'Mme', nom: 'Payet', prenom: 'Sandrine', date_naissance: '1978-01-30', commune: 'Le Guillaume', groupe_politique: 'Majorit\u00e9 municipale', email: 's.payet@example.re', telephone: '0692040404', qr_code: 'QR-ELU004' },
    { civilite: 'M.', nom: 'Nativel', prenom: 'Fr\u00e9d\u00e9ric', date_naissance: '1969-09-18', commune: 'Boucan Canot', groupe_politique: 'Opposition', email: 'f.nativel@example.re', telephone: '0692050505', qr_code: 'QR-ELU005' },
    { civilite: 'Mme', nom: 'Riviere', prenom: 'Nathalie', date_naissance: '1985-04-12', commune: 'La Saline', groupe_politique: 'Majorit\u00e9 municipale', email: 'n.riviere@example.re', telephone: '0692060606', qr_code: 'QR-ELU006' },
    { civilite: 'M.', nom: 'Lauret', prenom: 'David', date_naissance: '1974-06-25', commune: 'Saint-Paul', groupe_politique: 'Majorit\u00e9 municipale', email: 'd.lauret@example.re', telephone: '0692070707', qr_code: 'QR-ELU007' },
    { civilite: 'Mme', nom: 'Hoareau', prenom: 'V\u00e9ronique', date_naissance: '1982-12-08', commune: 'Trois-Bassins', groupe_politique: 'Opposition', email: 'v.hoareau@example.re', telephone: '0692080808', qr_code: 'QR-ELU008' },
    { civilite: 'M.', nom: 'Fontaine', prenom: 'Luc', date_naissance: '1990-02-14', commune: 'Le Port', groupe_politique: 'Majorit\u00e9 municipale', email: 'l.fontaine@example.re', telephone: '0692090909', qr_code: 'QR-ELU009' },
    { civilite: 'Mme', nom: 'Boyer', prenom: 'Christelle', date_naissance: '1976-08-03', commune: 'Saint-Leu', groupe_politique: 'Opposition', email: 'c.boyer@example.re', telephone: '0692101010', qr_code: 'QR-ELU010' },
  ];

  for (const p of participants) {
    await prisma.participant.upsert({
      where: { eventId_qrCode: { eventId: event.id, qrCode: p.qr_code } },
      update: {},
      create: {
        eventId: event.id,
        qrCode: p.qr_code,
        status: Status.ABSENT,
        data: p as any,
      },
    });
  }

  // 7. UserEvent assignments
  await prisma.userEvent.upsert({
    where: { userId_eventId: { userId: gestionnaire.id, eventId: event.id } },
    update: {},
    create: {
      userId: gestionnaire.id,
      eventId: event.id,
      eventRole: GlobalRole.ADMIN,
    },
  });

  await prisma.userEvent.upsert({
    where: { userId_eventId: { userId: accueil.id, eventId: event.id } },
    update: {},
    create: {
      userId: accueil.id,
      eventId: event.id,
      eventRole: GlobalRole.OPERATOR,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
