import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import { EmailService } from './email.service';
import { UpsertEmailConfigDto } from './dto/upsert-email-config.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events/:slug/email-config')
export class EmailConfigController {
  constructor(
    private emailConfigService: EmailConfigService,
    private emailService: EmailService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  find(@Param('slug') slug: string) {
    return this.emailConfigService.findByEvent(slug);
  }

  @Put()
  @Roles('SUPER_ADMIN', 'ADMIN')
  upsert(@Param('slug') slug: string, @Body() dto: UpsertEmailConfigDto) {
    return this.emailConfigService.upsert(slug, dto);
  }

  @Post('test')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendTest(
    @Param('slug') slug: string,
    @Body('toAddress') toAddress: string,
  ) {
    await this.emailService.sendTest(slug, toAddress);
    return { success: true, message: 'Email de test envoyé' };
  }
}
