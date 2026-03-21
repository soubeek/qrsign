import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerator } from '../signing/pdf.generator';
import { UpsertDocumentDto } from './dto/upsert-document.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentService {
  private readonly storagePath: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfGenerator: PdfGenerator,
  ) {
    this.storagePath = this.config.get('PDF_STORAGE_PATH') || './data/pdfs';
  }

  async findByEvent(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.documentDef.findMany({
      where: { eventId: event.id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(slug: string, dto: UpsertDocumentDto) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');

    const count = await this.prisma.documentDef.count({ where: { eventId: event.id } });

    return this.prisma.documentDef.create({
      data: {
        eventId: event.id,
        title: dto.title || 'Nouveau document',
        signingLabel: dto.signingLabel || 'Signer le document',
        declarationTemplate: dto.declarationTemplate || '',
        noticeSections: dto.noticeSections || [],
        pdfFooterText: dto.pdfFooterText || '',
        signatureWidthMm: dto.signatureWidthMm || 75,
        signatureHeightMm: dto.signatureHeightMm || 28,
        signaturePosition: dto.signaturePosition || 'left',
        logoPosition: dto.logoPosition || 'center',
        displayOrder: dto.displayOrder ?? count,
        required: dto.required ?? true,
      },
    });
  }

  async update(docId: string, dto: UpsertDocumentDto) {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.documentDef.update({
      where: { id: docId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.signingLabel !== undefined && { signingLabel: dto.signingLabel }),
        ...(dto.declarationTemplate !== undefined && { declarationTemplate: dto.declarationTemplate }),
        ...(dto.declarationAlign !== undefined && { declarationAlign: dto.declarationAlign }),
        ...(dto.noticeSections !== undefined && { noticeSections: dto.noticeSections }),
        ...(dto.pdfFooterText !== undefined && { pdfFooterText: dto.pdfFooterText }),
        ...(dto.signatureWidthMm !== undefined && { signatureWidthMm: dto.signatureWidthMm }),
        ...(dto.signatureHeightMm !== undefined && { signatureHeightMm: dto.signatureHeightMm }),
        ...(dto.signaturePosition !== undefined && { signaturePosition: dto.signaturePosition }),
        ...(dto.logoPosition !== undefined && { logoPosition: dto.logoPosition }),
        ...(dto.titlePosition !== undefined && { titlePosition: dto.titlePosition }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.required !== undefined && { required: dto.required }),
      },
    });
  }

  async remove(docId: string) {
    await this.prisma.documentDef.delete({ where: { id: docId } });
    return { success: true };
  }

  async reorder(slug: string, items: { id: string; displayOrder: number }[]) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.$transaction(
      items.map(item => this.prisma.documentDef.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } })),
    );
    return { success: true };
  }

  async uploadAsset(docId: string, type: 'logo' | 'background', file: Express.Multer.File) {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId }, include: { event: true } });
    if (!doc) throw new NotFoundException('Document not found');

    const dir = path.join(this.storagePath, doc.event.slug, 'assets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.originalname) || '.png';
    const filename = `${type}_${docId}${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const data = type === 'logo' ? { logoPath: filePath } : { backgroundPath: filePath };
    await this.prisma.documentDef.update({ where: { id: docId }, data });
    return { success: true, path: filePath, type };
  }

  async getAssetPath(docId: string, type: string): Promise<string | null> {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId } });
    if (!doc) return null;
    const assetPath = type === 'logo' ? doc.logoPath : doc.backgroundPath;
    if (!assetPath || !fs.existsSync(assetPath)) return null;
    return assetPath;
  }

  async removeAsset(docId: string, type: 'logo' | 'background') {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');

    const assetPath = type === 'logo' ? doc.logoPath : doc.backgroundPath;
    if (assetPath && fs.existsSync(assetPath)) fs.unlinkSync(assetPath);

    const data = type === 'logo' ? { logoPath: null } : { backgroundPath: null };
    await this.prisma.documentDef.update({ where: { id: docId }, data });
    return { success: true };
  }

  async generatePreview(docId: string): Promise<Buffer> {
    const doc = await this.prisma.documentDef.findUnique({
      where: { id: docId },
      include: { event: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    // Preview = document template only, no participant data, no signature
    return this.pdfGenerator.generate(null, doc.event, doc, '', new Date());
  }

  async getAssignments(docId: string) {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.documentAssignment.findMany({
      where: { documentDefId: docId },
      select: { participantId: true },
    });
  }

  async setAssignments(docId: string, participantIds: string[]) {
    const doc = await this.prisma.documentDef.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');

    // Delete existing assignments and create new ones
    await this.prisma.documentAssignment.deleteMany({ where: { documentDefId: docId } });

    if (participantIds.length > 0) {
      await this.prisma.documentAssignment.createMany({
        data: participantIds.map(pid => ({ documentDefId: docId, participantId: pid })),
      });
    }

    return { success: true, count: participantIds.length };
  }
}
