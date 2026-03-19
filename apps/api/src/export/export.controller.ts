import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events/:slug/export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('csv')
  @Roles('SUPER_ADMIN', 'ADMIN', 'VIEWER')
  async exportCsv(@Param('slug') slug: string, @Res() res: Response) {
    const csv = await this.exportService.exportCsv(slug);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}_export.csv"`,
    );
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get('pdfs')
  @Roles('SUPER_ADMIN', 'ADMIN', 'VIEWER')
  async exportPdfs(@Param('slug') slug: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}_pdfs.zip"`,
    );
    await this.exportService.exportPdfs(slug, res);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  getStats(@Param('slug') slug: string) {
    return this.exportService.getStats(slug);
  }
}
