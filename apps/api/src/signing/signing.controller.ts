import { Controller, Post, Param, Body } from '@nestjs/common';
import { SigningService } from './signing.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events/:slug/sign')
export class SigningController {
  constructor(private signingService: SigningService) {}

  @Post(':participantId/:documentDefId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  sign(
    @Param('slug') slug: string,
    @Param('participantId') participantId: string,
    @Param('documentDefId') documentDefId: string,
    @Body('signatureData') signatureData: string,
  ) {
    return this.signingService.sign(slug, participantId, documentDefId, signatureData);
  }
}
