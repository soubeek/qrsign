import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.event.findMany({
      include: {
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        fields: { orderBy: { displayOrder: 'asc' } },
        documents: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { participants: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(dto: CreateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Event slug already in use');
    return this.prisma.event.create({ data: dto });
  }

  async update(slug: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { slug }, data: dto });
  }

  async remove(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.event.delete({ where: { slug } });
    return { message: 'Event deleted' };
  }

  async getConfig(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        fields: { orderBy: { displayOrder: 'asc' } },
        documents: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Load global email config
    const emailConfig = await this.prisma.emailConfig.findFirst({
      select: { id: true, autoSendOnSign: true, allowManualSend: true },
    });

    return {
      event: {
        id: event.id, slug: event.slug, title: event.title,
        subtitle: event.subtitle, logoEmoji: event.logoEmoji,
        entitySingular: event.entitySingular, entityPlural: event.entityPlural,
        displayNameTpl: event.displayNameTpl, searchFields: event.searchFields,
        isActive: event.isActive,
      },
      fields: event.fields,
      documents: event.documents,
      email: emailConfig,
    };
  }
}
