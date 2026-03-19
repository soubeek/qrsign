import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckinService {
  constructor(private prisma: PrismaService) {}

  async scan(slug: string, qrCode: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        fields: { orderBy: { displayOrder: 'asc' } },
        documents: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const participant = await this.prisma.participant.findUnique({
      where: { eventId_qrCode: { eventId: event.id, qrCode } },
      include: {
        signatures: { include: { documentDef: { select: { id: true, title: true } } } },
      },
    });
    if (!participant) {
      throw new NotFoundException({ message: 'Badge non reconnu', code: 'QR_NOT_FOUND' });
    }

    if (participant.status === 'ABSENT') {
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { status: 'PRESENT' },
      });
      participant.status = 'PRESENT';
    }

    return { participant, fieldDefs: event.fields, documents: event.documents };
  }
}
