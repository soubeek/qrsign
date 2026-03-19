import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerator } from './pdf.generator';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly pdfStoragePath: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfGenerator: PdfGenerator,
  ) {
    this.pdfStoragePath = this.config.get('PDF_STORAGE_PATH') || './data/pdfs';
  }

  async sign(eventSlug: string, participantId: string, documentDefId: string, signatureData: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        fields: { orderBy: { displayOrder: 'asc' } },
        documents: { where: { required: true } },
        emailConfig: true,
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const documentDef = await this.prisma.documentDef.findUnique({ where: { id: documentDefId } });
    if (!documentDef) throw new NotFoundException('Document not found');

    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { signatures: true },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    // Check if already signed this document
    const existing = participant.signatures.find(s => s.documentDefId === documentDefId);
    if (existing) {
      return { success: true, alreadySigned: true, pdfUrl: `/api/events/${eventSlug}/participants/${participantId}/pdf/${documentDefId}` };
    }

    const signedAt = new Date();

    const pdfBuffer = await this.pdfGenerator.generate(
      participant as any,
      event,
      documentDef,
      signatureData,
      signedAt,
    );

    // Save PDF to disk
    const dir = path.join(this.pdfStoragePath, eventSlug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const pdfPath = path.join(dir, `${participantId}_${documentDefId}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Create ParticipantSignature record
    await this.prisma.participantSignature.create({
      data: {
        participantId,
        documentDefId,
        signedAt,
        pdfPath,
      },
    });

    // Check if all required documents are now signed
    const requiredDocIds = event.documents.map(d => d.id);
    const signedDocIds = [...participant.signatures.map(s => s.documentDefId), documentDefId];
    const allRequiredSigned = requiredDocIds.every(id => signedDocIds.includes(id));

    if (allRequiredSigned) {
      await this.prisma.participant.update({
        where: { id: participantId },
        data: { status: 'SIGNED' },
      });
    }

    // Count remaining unsigned docs
    const remainingCount = requiredDocIds.filter(id => !signedDocIds.includes(id)).length;

    return {
      success: true,
      pdfUrl: `/api/events/${eventSlug}/participants/${participantId}/pdf/${documentDefId}`,
      allSigned: allRequiredSigned,
      remainingDocs: remainingCount,
    };
  }
}
