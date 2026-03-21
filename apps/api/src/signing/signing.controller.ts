import { Controller, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { SigningService } from './signing.service';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_SIGNATURE_SIZE = 500_000; // ~500KB base64

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
    if (!signatureData || !signatureData.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('Format de signature invalide');
    }
    if (signatureData.length > MAX_SIGNATURE_SIZE) {
      throw new BadRequestException('Signature trop volumineuse');
    }
    return this.signingService.sign(slug, participantId, documentDefId, signatureData);
  }
}
