import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Prisma } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import * as QRCode from 'qrcode';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(slug: string, params: { search?: string; status?: string; limit?: number }) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        fields: { where: { displayInList: true }, orderBy: { displayOrder: 'asc' } },
        documents: { where: { required: true }, select: { id: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const limit = Math.min(params.limit || 20, 50);
    const where: any = { eventId: event.id };
    if (params.status) where.status = params.status;

    if (params.search && params.search.length >= 2) {
      const searchTerm = `%${params.search}%`;
      const participants = await this.prisma.$queryRaw<any[]>`
        SELECT id, qr_code as "qrCode", status, data, email_sent_at as "emailSentAt"
        FROM participants
        WHERE event_id = ${event.id}
        AND data::text ILIKE ${searchTerm}
        ${params.status ? Prisma.sql`AND status = ${params.status}::"Status"` : Prisma.sql``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      // Load signatures for each participant
      for (const p of participants) {
        p.signatures = await this.prisma.participantSignature.findMany({
          where: { participantId: p.id },
          include: { documentDef: { select: { id: true, title: true } } },
        });
      }
      return { participants, fields: event.fields, totalDocs: event.documents.length };
    }

    const participants = await this.prisma.participant.findMany({
      where,
      select: {
        id: true, qrCode: true, status: true, data: true, emailSentAt: true,
        signatures: {
          include: { documentDef: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { participants, fields: event.fields, totalDocs: event.documents.length };
  }

  async findOne(id: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      select: {
        id: true, eventId: true, qrCode: true, status: true, data: true,
        emailSentAt: true, createdAt: true, updatedAt: true,
        signatures: {
          include: { documentDef: { select: { id: true, title: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!participant) throw new NotFoundException('Participant not found');
    return participant;
  }

  async create(slug: string, dto: CreateParticipantDto) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.participant.create({
      data: { eventId: event.id, qrCode: dto.qrCode, data: dto.data },
    });
  }

  async update(id: string, slug: string, dto: UpdateParticipantDto) {
    const event = await this.prisma.event.findUnique({ where: { slug }, include: { fields: true } });
    if (!event) throw new NotFoundException('Event not found');
    const participant = await this.prisma.participant.findUnique({ where: { id } });
    if (!participant) throw new NotFoundException('Participant not found');

    const editableKeys = event.fields.filter(f => f.editable).map(f => f.key);
    const currentData = participant.data as Record<string, any>;
    const newData = { ...currentData };
    if (dto.data) {
      for (const [key, value] of Object.entries(dto.data)) {
        if (editableKeys.includes(key)) newData[key] = value;
      }
    }
    return this.prisma.participant.update({ where: { id }, data: { data: newData } });
  }

  async updateStatus(id: string, status: string) {
    const participant = await this.prisma.participant.findUnique({ where: { id } });
    if (!participant) throw new NotFoundException('Participant not found');

    const validStatuses = ['ABSENT', 'PRESENT', 'SIGNED'];
    if (!validStatuses.includes(status)) throw new NotFoundException('Invalid status');

    // If resetting from SIGNED, delete all signatures
    if (status !== 'SIGNED' && participant.status === 'SIGNED') {
      await this.prisma.participantSignature.deleteMany({ where: { participantId: id } });
    }

    return this.prisma.participant.update({ where: { id }, data: { status: status as any } });
  }

  async generateTemplateCsv(slug: string): Promise<string> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { fields: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!event) throw new NotFoundException('Event not found');

    const headers = event.fields.map(f => f.key);
    const labels = event.fields.map(f => f.label);

    // Example row with hints
    const example = event.fields.map(f => {
      if (f.isQrField) return 'QR-001';
      if (f.isEmailField) return 'exemple@email.fr';
      switch (f.type) {
        case 'SELECT': return f.options[0] || '';
        case 'DATE': return '01/01/1980';
        case 'TEL': return '0692000000';
        case 'NUMBER': return '0';
        case 'EMAIL': return 'exemple@email.fr';
        default: return f.required ? `(requis)` : '';
      }
    });

    const lines = [
      headers.join(';'),
      example.join(';'),
    ];

    return lines.join('\n');
  }

  async importCsv(slug: string, fileBuffer: Buffer) {
    const event = await this.prisma.event.findUnique({ where: { slug }, include: { fields: true } });
    if (!event) throw new NotFoundException('Event not found');

    const content = fileBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { created: 0, updated: 0, errors: ['File is empty'] };

    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = this.parseCsvLine(headerLine, separator);

    const qrField = event.fields.find(f => f.isQrField);
    const qrKey = qrField?.key || 'qr_code';
    const qrColIndex = headers.indexOf(qrKey);
    if (qrColIndex === -1) return { created: 0, updated: 0, errors: [`QR field "${qrKey}" not found in headers`] };

    let created = 0, updated = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i], separator);
      if (values.length !== headers.length) { errors.push(`Row ${i + 1}: column count mismatch`); continue; }
      const data: Record<string, any> = {};
      headers.forEach((h, idx) => { data[h] = values[idx]; });
      const qrCode = data[qrKey];
      if (!qrCode) { errors.push(`Row ${i + 1}: missing QR code`); continue; }

      try {
        const existing = await this.prisma.participant.findUnique({ where: { eventId_qrCode: { eventId: event.id, qrCode } } });
        if (existing) {
          await this.prisma.participant.update({ where: { id: existing.id }, data: { data } });
          updated++;
        } else {
          await this.prisma.participant.create({ data: { eventId: event.id, qrCode, data } });
          created++;
        }
      } catch (e) { errors.push(`Row ${i + 1}: ${e.message}`); }
    }
    return { created, updated, errors };
  }

  private parseCsvLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current.trim()); current = '';
      } else current += char;
    }
    result.push(current.trim());
    return result;
  }

  async getPdfPath(participantId: string, documentDefId: string): Promise<string> {
    const sig = await this.prisma.participantSignature.findUnique({
      where: { participantId_documentDefId: { participantId, documentDefId } },
    });
    if (!sig?.pdfPath) throw new NotFoundException('PDF not found');
    return sig.pdfPath;
  }

  async generateQrCodeImage(id: string): Promise<Buffer> {
    const participant = await this.prisma.participant.findUnique({ where: { id } });
    if (!participant) throw new NotFoundException('Participant not found');
    return QRCode.toBuffer(participant.qrCode, { type: 'png', width: 300, margin: 1 });
  }

  async generateBadgesPdf(slug: string): Promise<Buffer> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Pre-generate all QR codes and embed them once
    const qrCache = new Map<string, any>();
    for (const p of event.participants) {
      if (!qrCache.has(p.qrCode)) {
        try {
          const qrPng = await QRCode.toBuffer(p.qrCode, { type: 'png', width: 200, margin: 1 });
          qrCache.set(p.qrCode, await doc.embedPng(qrPng));
        } catch {}
      }
    }

    // Badge layout: 2 columns x 4 rows per A4 page
    const badgeW = 250;
    const badgeH = 180;
    const colGap = 30;
    const rowGap = 20;
    const startX = 35;
    const startY = 842 - 40;
    const cols = 2;
    const perPage = cols * 4;

    for (let i = 0; i < event.participants.length; i++) {
      const p = event.participants[i];
      const data = p.data as Record<string, any>;
      const posOnPage = i % perPage;

      if (posOnPage === 0) doc.addPage(PageSizes.A4);
      const page = doc.getPages()[doc.getPageCount() - 1];

      const col = posOnPage % cols;
      const row = Math.floor(posOnPage / cols);
      const x = startX + col * (badgeW + colGap);
      const y = startY - row * (badgeH + rowGap);

      // Border
      page.drawRectangle({
        x, y: y - badgeH, width: badgeW, height: badgeH,
        borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5, color: rgb(1, 1, 1),
      });

      // QR code (reuse cached image)
      const qrImage = qrCache.get(p.qrCode);
      if (qrImage) {
        const qrSize = 80;
        page.drawImage(qrImage, {
          x: x + badgeW - qrSize - 15,
          y: y - badgeH + (badgeH - qrSize) / 2,
          width: qrSize, height: qrSize,
        });
      }

      // Text
      const textX = x + 15;
      let textY = y - 25;

      page.drawText(event.title, { x: textX, y: textY, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      textY -= 18;

      const nom = (data['nom'] || '').toUpperCase();
      const prenom = data['prenom'] || '';
      const civilite = data['civilite'] || '';
      page.drawText(`${civilite} ${nom}`, { x: textX, y: textY, size: 12, font: fontBold, color: rgb(0, 0, 0) });
      textY -= 16;
      page.drawText(prenom, { x: textX, y: textY, size: 11, font, color: rgb(0, 0, 0) });

      page.drawText(p.qrCode, { x: textX, y: y - badgeH + 10, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
    }

    return Buffer.from(await doc.save());
  }
}
