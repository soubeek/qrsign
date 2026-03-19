import { Module } from '@nestjs/common';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { PdfGenerator } from './pdf.generator';

@Module({
  controllers: [SigningController],
  providers: [SigningService, PdfGenerator],
  exports: [SigningService],
})
export class SigningModule {}
