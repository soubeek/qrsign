import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PdfGenerator } from '../signing/pdf.generator';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, PdfGenerator],
  exports: [DocumentService],
})
export class DocumentModule {}
