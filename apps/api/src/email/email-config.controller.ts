import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import { EmailService } from './email.service';
import { UpsertEmailConfigDto } from './dto/upsert-email-config.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('email-config')
export class EmailConfigController {
  constructor(
    private emailConfigService: EmailConfigService,
    private emailService: EmailService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  find() {
    return this.emailConfigService.find();
  }

  @Put()
  @Roles('SUPER_ADMIN', 'ADMIN')
  upsert(@Body() dto: UpsertEmailConfigDto) {
    return this.emailConfigService.upsert(dto);
  }

  @Post('test')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendTest(@Body('toAddress') toAddress: string) {
    await this.emailService.sendTest(toAddress);
    return { success: true, message: 'Email de test envoye' };
  }
}
