import { Controller, Get, Put, Post, Delete, Param, Body, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentService } from './document.service';
import { UpsertDocumentDto } from './dto/upsert-document.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import * as path from 'path';

@Controller('events/:slug/document')
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll(@Param('slug') slug: string) {
    return this.documentService.findByEvent(slug);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Param('slug') slug: string, @Body() dto: UpsertDocumentDto) {
    return this.documentService.create(slug, dto);
  }

  @Put(':docId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('docId') docId: string, @Body() dto: UpsertDocumentDto) {
    return this.documentService.update(docId, dto);
  }

  @Delete(':docId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('docId') docId: string) {
    return this.documentService.remove(docId);
  }

  @Post('reorder')
  @Roles('SUPER_ADMIN', 'ADMIN')
  reorder(@Param('slug') slug: string, @Body('items') items: { id: string; displayOrder: number }[]) {
    return this.documentService.reorder(slug, items);
  }

  @Post(':docId/preview')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async preview(@Param('docId') docId: string, @Res() res: Response) {
    const pdfBuffer = await this.documentService.generatePreview(docId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(pdfBuffer);
  }

  @Post(':docId/upload-logo')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@Param('docId') docId: string, @UploadedFile() file: Express.Multer.File) {
    return this.documentService.uploadAsset(docId, 'logo', file);
  }

  @Post(':docId/upload-background')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadBackground(@Param('docId') docId: string, @UploadedFile() file: Express.Multer.File) {
    return this.documentService.uploadAsset(docId, 'background', file);
  }

  @Get(':docId/asset/:type')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  async getAsset(@Param('docId') docId: string, @Param('type') type: string, @Res() res: Response) {
    const filePath = await this.documentService.getAssetPath(docId, type);
    if (!filePath) { res.status(404).json({ message: 'Asset not found' }); return; }
    res.sendFile(path.resolve(filePath));
  }

  @Post(':docId/remove-logo')
  @Roles('SUPER_ADMIN', 'ADMIN')
  removeLogo(@Param('docId') docId: string) {
    return this.documentService.removeAsset(docId, 'logo');
  }

  @Post(':docId/remove-background')
  @Roles('SUPER_ADMIN', 'ADMIN')
  removeBackground(@Param('docId') docId: string) {
    return this.documentService.removeAsset(docId, 'background');
  }

  @Get(':docId/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  getAssignments(@Param('docId') docId: string) {
    return this.documentService.getAssignments(docId);
  }

  @Post(':docId/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  setAssignments(@Param('docId') docId: string, @Body('participantIds') participantIds: string[]) {
    return this.documentService.setAssignments(docId, participantIds || []);
  }
}
