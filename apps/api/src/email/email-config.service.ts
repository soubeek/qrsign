import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { UpsertEmailConfigDto } from './dto/upsert-email-config.dto';

@Injectable()
export class EmailConfigService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async find() {
    const config = await this.prisma.emailConfig.findFirst();
    if (!config) return null;
    return { ...config, smtpPass: '••••••••' };
  }

  async upsert(dto: UpsertEmailConfigDto) {
    const existing = await this.prisma.emailConfig.findFirst();

    const data: any = {
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort ?? 587,
      smtpSecure: dto.smtpSecure ?? false,
      smtpAuth: dto.smtpAuth ?? true,
      smtpUser: dto.smtpUser || '',
      fromAddress: dto.fromAddress,
      fromName: dto.fromName,
      autoSendOnSign: dto.autoSendOnSign ?? false,
      allowManualSend: dto.allowManualSend ?? true,
      subject: dto.subject || 'Votre document signe',
      bodyTemplate: dto.bodyTemplate || '',
    };

    if (dto.smtpPass && dto.smtpPass !== '••••••••') {
      data.smtpPass = this.emailService.encrypt(dto.smtpPass);
    }

    if (existing) {
      if (!data.smtpPass) delete data.smtpPass;
      return this.prisma.emailConfig.update({ where: { id: existing.id }, data });
    } else {
      if (!data.smtpPass) data.smtpPass = this.emailService.encrypt('');
      return this.prisma.emailConfig.create({ data });
    }
  }
}
