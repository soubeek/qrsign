import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigService } from './email-config.service';
import { EmailConfigController } from './email-config.controller';

@Module({
  controllers: [EmailConfigController],
  providers: [EmailService, EmailConfigService],
  exports: [EmailService],
})
export class EmailModule {}
