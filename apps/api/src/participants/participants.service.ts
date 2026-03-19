import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Prisma } from '@prisma/client';

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
}
