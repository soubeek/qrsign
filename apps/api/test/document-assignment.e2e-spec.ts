import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Document Assignment', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('DocumentAssignment model', () => {
    let eventId: string;
    let testDocId: string;
    let participant1Id: string;
    let participant2Id: string;

    beforeAll(async () => {
      const event = await prisma.event.findUnique({ where: { slug: 'conseil-municipal' } });
      if (!event) throw new Error('Seed data required');
      eventId = event.id;

      const participants = await prisma.participant.findMany({
        where: { eventId },
        take: 2,
      });
      if (participants.length < 2) throw new Error('Need at least 2 participants');
      participant1Id = participants[0].id;
      participant2Id = participants[1].id;
    });

    beforeEach(async () => {
      // Create a fresh test document for each test
      const doc = await prisma.documentDef.create({
        data: {
          eventId,
          title: 'Test Assignment',
          declarationTemplate: 'test declaration',
          required: true,
        },
      });
      testDocId = doc.id;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.documentAssignment.deleteMany({ where: { documentDefId: testDocId } });
      await prisma.documentDef.delete({ where: { id: testDocId } });
    });

    it('should create a document assignment', async () => {
      const assignment = await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: participant1Id },
      });

      expect(assignment.id).toBeDefined();
      expect(assignment.documentDefId).toBe(testDocId);
      expect(assignment.participantId).toBe(participant1Id);
    });

    it('should enforce unique constraint (doc + participant)', async () => {
      await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: participant1Id },
      });

      await expect(
        prisma.documentAssignment.create({
          data: { documentDefId: testDocId, participantId: participant1Id },
        }),
      ).rejects.toThrow();
    });

    it('should allow same doc assigned to different participants', async () => {
      await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: participant1Id },
      });
      await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: participant2Id },
      });

      const assignments = await prisma.documentAssignment.findMany({
        where: { documentDefId: testDocId },
      });
      expect(assignments.length).toBe(2);
    });

    it('should cascade delete when document is deleted', async () => {
      await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: participant1Id },
      });

      await prisma.documentDef.delete({ where: { id: testDocId } });

      const remaining = await prisma.documentAssignment.findMany({
        where: { documentDefId: testDocId },
      });
      expect(remaining.length).toBe(0);

      // Recreate doc for afterEach cleanup to not fail
      const doc = await prisma.documentDef.create({
        data: { id: testDocId, eventId, title: 'Recreated', declarationTemplate: '', required: true },
      });
      testDocId = doc.id;
    });

    it('should cascade delete when participant is deleted', async () => {
      // Create a temporary participant
      const tempParticipant = await prisma.participant.create({
        data: { eventId, qrCode: 'QR-TEMP-ASSIGN-TEST', data: { nom: 'Temp' } },
      });

      await prisma.documentAssignment.create({
        data: { documentDefId: testDocId, participantId: tempParticipant.id },
      });

      await prisma.participant.delete({ where: { id: tempParticipant.id } });

      const remaining = await prisma.documentAssignment.findMany({
        where: { participantId: tempParticipant.id },
      });
      expect(remaining.length).toBe(0);
    });
  });

  describe('Per-participant document filtering logic', () => {
    let eventId: string;
    let participant1Id: string;
    let participant2Id: string;

    beforeAll(async () => {
      const event = await prisma.event.findUnique({ where: { slug: 'conseil-municipal' } });
      eventId = event!.id;
      const participants = await prisma.participant.findMany({ where: { eventId }, take: 2 });
      participant1Id = participants[0].id;
      participant2Id = participants[1].id;
    });

    it('doc without assignments should be visible to all', async () => {
      const doc = await prisma.documentDef.create({
        data: { eventId, title: 'Global Doc', declarationTemplate: 'test', required: true },
      });

      const allDocs = await prisma.documentDef.findMany({
        where: { id: doc.id },
        include: { assignments: { select: { participantId: true } } },
      });

      const docsForP1 = allDocs.filter(d =>
        d.assignments.length === 0 || d.assignments.some(a => a.participantId === participant1Id),
      );
      const docsForP2 = allDocs.filter(d =>
        d.assignments.length === 0 || d.assignments.some(a => a.participantId === participant2Id),
      );

      expect(docsForP1.length).toBe(1);
      expect(docsForP2.length).toBe(1);

      await prisma.documentDef.delete({ where: { id: doc.id } });
    });

    it('doc assigned to P1 should only be visible to P1', async () => {
      const doc = await prisma.documentDef.create({
        data: { eventId, title: 'P1 Only Doc', declarationTemplate: 'test', required: true },
      });

      await prisma.documentAssignment.create({
        data: { documentDefId: doc.id, participantId: participant1Id },
      });

      const allDocs = await prisma.documentDef.findMany({
        where: { id: doc.id },
        include: { assignments: { select: { participantId: true } } },
      });

      const docsForP1 = allDocs.filter(d =>
        d.assignments.length === 0 || d.assignments.some(a => a.participantId === participant1Id),
      );
      const docsForP2 = allDocs.filter(d =>
        d.assignments.length === 0 || d.assignments.some(a => a.participantId === participant2Id),
      );

      expect(docsForP1.length).toBe(1);
      expect(docsForP2.length).toBe(0);

      await prisma.documentAssignment.deleteMany({ where: { documentDefId: doc.id } });
      await prisma.documentDef.delete({ where: { id: doc.id } });
    });

    it('clearing assignments makes doc visible to all again', async () => {
      const doc = await prisma.documentDef.create({
        data: { eventId, title: 'Cleared Doc', declarationTemplate: 'test', required: true },
      });

      // Assign to P1 only
      await prisma.documentAssignment.create({
        data: { documentDefId: doc.id, participantId: participant1Id },
      });

      // Clear assignments
      await prisma.documentAssignment.deleteMany({ where: { documentDefId: doc.id } });

      const allDocs = await prisma.documentDef.findMany({
        where: { id: doc.id },
        include: { assignments: true },
      });

      const docsForP2 = allDocs.filter(d =>
        d.assignments.length === 0 || d.assignments.some(a => a.participantId === participant2Id),
      );
      expect(docsForP2.length).toBe(1);

      await prisma.documentDef.delete({ where: { id: doc.id } });
    });

    it('set assignments replaces previous assignments', async () => {
      const doc = await prisma.documentDef.create({
        data: { eventId, title: 'Replace Test', declarationTemplate: 'test', required: true },
      });

      // Assign to P1
      await prisma.documentAssignment.create({
        data: { documentDefId: doc.id, participantId: participant1Id },
      });

      // Replace: delete all, assign to P2
      await prisma.documentAssignment.deleteMany({ where: { documentDefId: doc.id } });
      await prisma.documentAssignment.create({
        data: { documentDefId: doc.id, participantId: participant2Id },
      });

      const assignments = await prisma.documentAssignment.findMany({
        where: { documentDefId: doc.id },
      });
      expect(assignments.length).toBe(1);
      expect(assignments[0].participantId).toBe(participant2Id);

      await prisma.documentAssignment.deleteMany({ where: { documentDefId: doc.id } });
      await prisma.documentDef.delete({ where: { id: doc.id } });
    });
  });
});
