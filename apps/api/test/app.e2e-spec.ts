import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CheckFlow API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let operatorToken: string;

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

  // ── Auth ────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /api/auth/login — valid credentials', async () => {
      const user = await prisma.user.findUnique({ where: { email: 'admin@checkflow.local' } });
      console.log('DB USER:', user?.email, 'active:', user?.isActive, 'hash:', user?.passwordHash?.substring(0, 15));

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@checkflow.local', password: 'Admin1234!' });

      console.log('LOGIN:', res.status, JSON.stringify(res.body).substring(0, 150));
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('admin@checkflow.local');
      expect(res.body.user.role).toBe('SUPER_ADMIN');
      adminToken = res.body.accessToken;
    });

    it('POST /api/auth/login — operator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'accueil@checkflow.local', password: 'Acc1234!' })
        .expect(201);

      operatorToken = res.body.accessToken;
      expect(res.body.user.role).toBe('OPERATOR');
    });

    it('POST /api/auth/login — invalid password → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@checkflow.local', password: 'wrong' })
        .expect(401);
    });

    it('POST /api/auth/login — missing fields → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@checkflow.local' })
        .expect(400);
    });

    it('GET /api/auth/me — with token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.email).toBe('admin@checkflow.local');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('GET /api/auth/me — without token → 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  // ── Events ──────────────────────────────────────────

  describe('Events', () => {
    it('GET /api/events/:slug/config — public', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/config')
        .expect(200);

      expect(res.body.event.title).toBe('Conseil Municipal');
      expect(res.body.fields.length).toBeGreaterThan(0);
      expect(res.body.documents.length).toBeGreaterThan(0);
    });

    it('GET /api/events — requires auth', async () => {
      await request(app.getHttpServer()).get('/api/events').expect(401);
    });

    it('GET /api/events — with admin token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/events/:slug/operators — public', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/operators')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Participants ────────────────────────────────────

  describe('Participants', () => {
    it('GET /api/events/:slug/participants — list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/participants?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.participants).toBeDefined();
      expect(res.body.fields).toBeDefined();
    });

    it('GET /api/events/:slug/participants — search', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/participants?search=Hoarau')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.participants.length).toBeGreaterThan(0);
    });

    it('GET /api/events/:slug/participants/template-csv', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/participants/template-csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('civilite');
    });
  });

  // ── Checkin + Signing ───────────────────────────────

  describe('Checkin & Signing flow', () => {
    let participantId: string;
    let doc1Id: string;
    let doc2Id: string;

    it('POST /api/events/:slug/checkin/scan — valid QR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events/conseil-municipal/checkin/scan')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ qrCode: 'QR-ELU001' })
        .expect(201);

      expect(res.body.participant).toBeDefined();
      expect(res.body.documents.length).toBeGreaterThan(0);
      participantId = res.body.participant.id;
      doc1Id = res.body.documents[0].id;
      doc2Id = res.body.documents[1]?.id;
    });

    it('POST /api/events/:slug/checkin/scan — invalid QR → 404', async () => {
      await request(app.getHttpServer())
        .post('/api/events/conseil-municipal/checkin/scan')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ qrCode: 'INVALID-QR' })
        .expect(404);
    });

    it('Sign doc1 → allSigned false', async () => {
      if (!doc2Id) return; // skip if only 1 doc
      const res = await request(app.getHttpServer())
        .post(`/api/events/conseil-municipal/sign/${participantId}/${doc1Id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.allSigned).toBe(false);
    });

    it('Participant should still be PRESENT after 1 doc', async () => {
      if (!doc2Id) return;
      const res = await request(app.getHttpServer())
        .get(`/api/events/conseil-municipal/participants/${participantId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.status).toBe('PRESENT');
      expect(res.body.signatures.length).toBe(1);
    });

    it('Sign doc2 → allSigned true', async () => {
      if (!doc2Id) return;
      const res = await request(app.getHttpServer())
        .post(`/api/events/conseil-municipal/sign/${participantId}/${doc2Id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
        .expect(201);

      expect(res.body.allSigned).toBe(true);
    });

    it('Participant should be SIGNED after all docs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/conseil-municipal/participants/${participantId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.status).toBe('SIGNED');
      expect(res.body.signatures.length).toBe(doc2Id ? 2 : 1);
    });

    it('Sign same doc again → alreadySigned', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/conseil-municipal/sign/${participantId}/${doc1Id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ signatureData: 'data:image/png;base64,...' })
        .expect(201);

      expect(res.body.alreadySigned).toBe(true);
    });
  });

  // ── Documents ───────────────────────────────────────

  describe('Documents', () => {
    it('GET /api/events/:slug/document — list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/document')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('POST /api/events/:slug/document — create', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events/conseil-municipal/document')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test Document', signingLabel: 'Sign test', declarationTemplate: 'I declare', required: false })
        .expect(201);

      expect(res.body.title).toBe('Test Document');
      expect(res.body.required).toBe(false);

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/api/events/conseil-municipal/document/${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('Operator cannot create documents → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/events/conseil-municipal/document')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ title: 'Hack' })
        .expect(403);
    });
  });

  // ── Export ──────────────────────────────────────────

  describe('Export', () => {
    it('GET /api/events/:slug/export/stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/export/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBeDefined();
      expect(res.body.present).toBeDefined();
      expect(res.body.signed).toBeDefined();
      expect(res.body.absent).toBeDefined();
    });

    it('GET /api/events/:slug/export/csv', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/export/csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // ── Authorization ───────────────────────────────────

  describe('Authorization', () => {
    it('Operator cannot access /users', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
    });

    it('Operator cannot delete participants', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/events/conseil-municipal/participants?limit=1')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      if (list.body.participants?.[0]) {
        await request(app.getHttpServer())
          .delete(`/api/events/conseil-municipal/participants/${list.body.participants[0].id}`)
          .set('Authorization', `Bearer ${operatorToken}`)
          .expect(403);
      }
    });

    it('Admin can list users', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
