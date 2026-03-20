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
        userAccess: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        },
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

  async clone(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { fields: true, documents: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const newSlug = `${slug}-copie-${Date.now().toString(36)}`;
    const newEvent = await this.prisma.event.create({
      data: {
        slug: newSlug,
        title: `${event.title} (copie)`,
        subtitle: event.subtitle,
        logoEmoji: event.logoEmoji,
        entitySingular: event.entitySingular,
        entityPlural: event.entityPlural,
        displayNameTpl: event.displayNameTpl,
        searchFields: event.searchFields,
      },
    });

    // Clone fields
    for (const f of event.fields) {
      await this.prisma.fieldDef.create({
        data: {
          eventId: newEvent.id, key: f.key, label: f.label, type: f.type,
          options: f.options, editable: f.editable, required: f.required,
          displayInList: f.displayInList, displayOrder: f.displayOrder,
          isQrField: f.isQrField, isEmailField: f.isEmailField,
        },
      });
    }

    // Clone documents (without signatures)
    for (const d of event.documents) {
      await this.prisma.documentDef.create({
        data: {
          eventId: newEvent.id, title: d.title, signingLabel: d.signingLabel,
          declarationTemplate: d.declarationTemplate, declarationAlign: d.declarationAlign,
          noticeSections: d.noticeSections as any, pdfFooterText: d.pdfFooterText,
          signatureWidthMm: d.signatureWidthMm, signatureHeightMm: d.signatureHeightMm,
          logoPosition: d.logoPosition, titlePosition: d.titlePosition,
          displayOrder: d.displayOrder, required: d.required,
        },
      });
    }

    return newEvent;
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

  async getOperators(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        userAccess: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
            },
          },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Only users assigned to this event (no SUPER_ADMIN)
    return event.userAccess
      .filter(ua => ua.user.isActive)
      .map(ua => ({
        id: ua.user.id,
        firstName: ua.user.firstName,
        lastName: ua.user.lastName,
        email: ua.user.email,
        role: ua.eventRole || ua.user.role,
      }));
  }
}
