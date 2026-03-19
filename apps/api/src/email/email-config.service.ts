import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { UpsertEmailConfigDto } from './dto/upsert-email-config.dto';

@Injectable()
export class EmailConfigService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async findByEvent(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { emailConfig: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.emailConfig) return null;

    return {
      ...event.emailConfig,
      smtpPass: '••••••••',
    };
  }

  async upsert(slug: string, dto: UpsertEmailConfigDto) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');

    const data: any = {
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort ?? 587,
      smtpSecure: dto.smtpSecure ?? false,
      smtpUser: dto.smtpUser,
      fromAddress: dto.fromAddress,
      fromName: dto.fromName,
      autoSendOnSign: dto.autoSendOnSign ?? false,
      allowManualSend: dto.allowManualSend ?? true,
      subject: dto.subject || 'Votre document signé',
      bodyTemplate: dto.bodyTemplate || '',
    };

    if (dto.smtpPass && dto.smtpPass !== '••••••••') {
      data.smtpPass = this.emailService.encrypt(dto.smtpPass);
    }

    const existing = await this.prisma.emailConfig.findUnique({
      where: { eventId: event.id },
    });

    if (existing) {
      if (!data.smtpPass) delete data.smtpPass;
      return this.prisma.emailConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      if (!data.smtpPass) {
        data.smtpPass = this.emailService.encrypt('');
      }
      return this.prisma.emailConfig.create({
        data: { ...data, eventId: event.id },
      });
    }
  }
}
