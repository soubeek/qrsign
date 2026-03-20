import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Res,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ParticipantsService } from './participants.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { EmailService } from '../email/email.service';
import { Roles } from '../auth/decorators/roles.decorator';
import * as path from 'path';

@Controller('events/:slug/participants')
export class ParticipantsController {
  constructor(
    private participantsService: ParticipantsService,
    private emailService: EmailService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  findAll(
    @Param('slug') slug: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.participantsService.findAll(slug, { search, status, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('template-csv')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getTemplateCsv(@Param('slug') slug: string, @Res() res: Response) {
    const csv = await this.participantsService.generateTemplateCsv(slug);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}_modele_import.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('badges')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async exportBadges(@Param('slug') slug: string, @Res() res: Response) {
    const pdfBuffer = await this.participantsService.generateBadgesPdf(slug);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}_badges.pdf"`);
    res.send(pdfBuffer);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Param('slug') slug: string, @Body() dto: CreateParticipantDto) {
    return this.participantsService.create(slug, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }

  @Get(':id/qrcode')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  async getQrCode(@Param('id') id: string, @Res() res: Response) {
    const pngBuffer = await this.participantsService.generateQrCodeImage(id);
    res.setHeader('Content-Type', 'image/png');
    res.send(pngBuffer);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.participantsService.findOne(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @Param('slug') slug: string, @Body() dto: UpdateParticipantDto) {
    return this.participantsService.update(id, slug, dto);
  }

  @Post(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.participantsService.updateStatus(id, status);
  }

  @Post('send-emails')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendBulkEmails(@Param('slug') slug: string) {
    return this.participantsService.sendBulkEmails(slug, this.emailService);
  }

  @Post('import')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@Param('slug') slug: string, @UploadedFile() file: Express.Multer.File) {
    return this.participantsService.importCsv(slug, file.buffer);
  }

  @Get(':id/pdf/:docId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  async getPdf(@Param('id') id: string, @Param('docId') docId: string, @Res() res: Response) {
    const pdfPath = await this.participantsService.getPdfPath(id, docId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdfPath)}"`);
    res.sendFile(path.resolve(pdfPath));
  }

  @Post(':id/email')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendEmail(@Param('id') id: string) {
    await this.emailService.sendSignedDocument(id);
    return { success: true, message: 'Email envoye' };
  }
}
