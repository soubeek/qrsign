import { Controller, Post, Param, Body } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events/:slug/checkin')
export class CheckinController {
  constructor(private checkinService: CheckinService) {}

  @Post('scan')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  scan(@Param('slug') slug: string, @Body('qrCode') qrCode: string) {
    return this.checkinService.scan(slug, qrCode);
  }
}
