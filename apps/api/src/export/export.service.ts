import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as archiver from 'archiver';
import * as fs from 'fs';
import { Writable } from 'stream';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportCsv(slug: string): Promise<string> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        fields: { orderBy: { displayOrder: 'asc' } },
        participants: { include: { signatures: { include: { documentDef: true } } } },
        documents: { where: { required: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const headers = event.fields.map(f => f.key);
    const headerLabels = event.fields.map(f => f.label);
    const lines: string[] = [
      [...headerLabels, 'statut', 'docs_signes', 'email_envoye_le'].join(';'),
    ];

    const totalRequired = event.documents.length;

    for (const p of event.participants) {
      const data = p.data as Record<string, any>;
      const values = headers.map(h => {
        let val = String(data[h] ?? '');
        // Prevent CSV formula injection
        if (/^[=+\-@\t\r]/.test(val)) val = "'" + val;
        return val.includes(';') ? `"${val}"` : val;
      });
      values.push(
        p.status,
        `${p.signatures.length}/${totalRequired}`,
        p.emailSentAt?.toLocaleDateString('fr-FR') || '',
      );
      lines.push(values.join(';'));
    }
    return lines.join('\n');
  }

  async exportPdfs(slug: string, output: Writable): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        participants: {
          where: { status: 'SIGNED' },
          include: { signatures: { include: { documentDef: true } } },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    for (const p of event.participants) {
      const data = p.data as Record<string, any>;
      const name = `${data['nom'] || 'participant'}_${data['prenom'] || ''}`;
      for (const sig of p.signatures) {
        if (sig.pdfPath && fs.existsSync(sig.pdfPath)) {
          const docTitle = sig.documentDef?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'document';
          archive.file(sig.pdfPath, { name: `${name}_${docTitle}.pdf` });
        }
      }
    }
    await archive.finalize();
  }

  async getStats(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { participants: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const signed = event.participants.filter(p => p.status === 'SIGNED').length;
    const presentOnly = event.participants.filter(p => p.status === 'PRESENT').length;
    return {
      total: event.participants.length,
      present: presentOnly + signed, // SIGNED implies PRESENT
      signed,
      absent: event.participants.filter(p => p.status === 'ABSENT').length,
      emailSent: event.participants.filter(p => p.emailSentAt).length,
    };
  }
}
