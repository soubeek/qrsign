import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import * as fs from 'fs';

@Injectable()
export class PdfGenerator {
  private readonly logger = new Logger(PdfGenerator.name);

  async generate(
    participant: { data: Record<string, any> } | null,
    event: { title: string; subtitle?: string | null },
    documentDef: {
      title: string;
      titlePosition?: string;
      declarationTemplate: string;
      noticeSections: any;
      pdfFooterText: string;
      signatureWidthMm: number;
      signatureHeightMm: number;
      logoPath?: string | null;
      logoPosition?: string;
      backgroundPath?: string | null;
    },
    signatureData: string,
    signedAt: Date,
  ): Promise<Buffer> {
    const doc = await PDFDocument.create();
    let page = doc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;
    let y = height - margin;

    // Embed background image on every page if provided
    let bgImage: any = null;
    if (documentDef.backgroundPath && fs.existsSync(documentDef.backgroundPath)) {
      try {
        const bgBytes = fs.readFileSync(documentDef.backgroundPath);
        const ext = documentDef.backgroundPath.toLowerCase();
        if (ext.endsWith('.png')) {
          bgImage = await doc.embedPng(bgBytes);
        } else {
          bgImage = await doc.embedJpg(bgBytes);
        }
      } catch (e) {
        this.logger.warn(`Failed to embed background: ${e}`);
      }
    }

    // Draw background on first page
    if (bgImage) {
      page.drawImage(bgImage, { x: 0, y: 0, width, height, opacity: 0.15 });
    }

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < margin + 40) {
        page = doc.addPage(PageSizes.A4);
        y = height - margin;
        // Draw background on new page too
        if (bgImage) {
          page.drawImage(bgImage, { x: 0, y: 0, width, height, opacity: 0.15 });
        }
      }
    };

    const drawText = (
      text: string,
      size: number,
      f = font,
      color = rgb(0, 0, 0),
    ) => {
      const maxWidth = width - 2 * margin;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = f.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && line) {
          addNewPageIfNeeded(size + 4);
          page.drawText(line, { x: margin, y, size, font: f, color });
          y -= size + 4;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        addNewPageIfNeeded(size + 4);
        page.drawText(line, { x: margin, y, size, font: f, color });
        y -= size + 4;
      }
      y -= 4;
    };

    // Logo — positioned near top of page with reduced margin
    if (documentDef.logoPath && fs.existsSync(documentDef.logoPath)) {
      try {
        const logoBytes = fs.readFileSync(documentDef.logoPath);
        const ext = documentDef.logoPath.toLowerCase();
        const logoImage = ext.endsWith('.png')
          ? await doc.embedPng(logoBytes)
          : await doc.embedJpg(logoBytes);

        const logoDims = logoImage.scale(1);
        const maxW = 140;
        const maxH = 70;
        const scale = Math.min(maxW / logoDims.width, maxH / logoDims.height, 1);
        const logoW = logoDims.width * scale;
        const logoH = logoDims.height * scale;

        // Place logo at very top (20pt from top edge)
        const logoY = height - 20 - logoH;
        const pos = documentDef.logoPosition || 'center';
        let logoX: number;
        if (pos === 'left') logoX = margin;
        else if (pos === 'right') logoX = width - margin - logoW;
        else logoX = (width - logoW) / 2;

        page.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: logoW,
          height: logoH,
        });

        // Move y below logo
        y = logoY - 12;
      } catch (e) {
        this.logger.warn(`Failed to embed logo: ${e}`);
      }
    }

    // Space between logo and title
    y -= 8;

    // Document title — positioned left, center or right
    const titlePos = documentDef.titlePosition || 'center';
    const titleSize = 18;
    const titleText = documentDef.title || '';
    const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
    let titleX: number;
    if (titlePos === 'left') titleX = margin;
    else if (titlePos === 'right') titleX = width - margin - titleWidth;
    else titleX = (width - titleWidth) / 2;

    addNewPageIfNeeded(titleSize + 4);
    page.drawText(titleText, { x: titleX, y, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });
    y -= titleSize + 16;

    // Separator line
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 16;

    // Notice sections
    const sections = Array.isArray(documentDef.noticeSections)
      ? documentDef.noticeSections
      : JSON.parse(documentDef.noticeSections || '[]');
    for (const section of sections) {
      addNewPageIfNeeded(40);
      if (section.title) drawText(section.title, 11, fontBold);
      if (section.content) drawText(section.content, 9);
      y -= 8;
    }

    // Declaration
    y -= 8;
    let declaration = documentDef.declarationTemplate || '';
    if (participant) {
      for (const [key, value] of Object.entries(participant.data)) {
        declaration = declaration.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          String(value || ''),
        );
      }
    }
    const dateStr =
      signedAt.toLocaleDateString('fr-FR') +
      ' a ' +
      signedAt.toLocaleTimeString('fr-FR');
    declaration = declaration.replace('{signedAt}', dateStr);
    drawText(declaration, 10);
    y -= 12;

    // Signature image
    if (signatureData) {
      try {
        const base64 = signatureData.replace(/^data:image\/png;base64,/, '');
        const sigBytes = Buffer.from(base64, 'base64');
        const sigImage = await doc.embedPng(sigBytes);
        const sigWidth = (documentDef.signatureWidthMm / 25.4) * 72;
        const sigHeight = (documentDef.signatureHeightMm / 25.4) * 72;
        addNewPageIfNeeded(sigHeight + 12);
        page.drawImage(sigImage, {
          x: margin,
          y: y - sigHeight,
          width: sigWidth,
          height: sigHeight,
        });
        y -= sigHeight + 12;
      } catch {
        drawText('[Signature non disponible]', 9, font, rgb(0.5, 0.5, 0.5));
      }
    }

    // Footer on all pages
    const pageCount = doc.getPageCount();
    const pages = doc.getPages();
    for (let i = 0; i < pageCount; i++) {
      const p = pages[i];
      const footerY = 30;
      if (documentDef.pdfFooterText) {
        p.drawText(documentDef.pdfFooterText, {
          x: margin,
          y: footerY + 12,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
      p.drawText(`Signe le ${dateStr}`, {
        x: margin,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      p.drawText(`Page ${i + 1}/${pageCount}`, {
        x: width - margin - 50,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }
}
