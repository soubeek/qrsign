import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { encrypt } from 'node-qpdf2';

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
      declarationAlign?: string;
      noticeSections: any;
      pdfFooterText: string;
      signatureWidthMm: number;
      signatureHeightMm: number;
      signaturePosition?: string;
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

    // Strip characters that WinAnsi (Helvetica) cannot encode
    const sanitize = (t: string) => t.replace(/[^\x00-\xFF]/g, (ch) => {
      // Replace common unicode with ASCII equivalents
      const map: Record<string, string> = {
        '\u2019': "'", '\u2018': "'", '\u201C': '"', '\u201D': '"',
        '\u2013': '-', '\u2014': '--', '\u2026': '...', '\u00AB': '"', '\u00BB': '"',
        '\u2611': '[x]', '\u2610': '[ ]', '\u2022': '-', '\u2023': '>',
        '\u00E9': 'e', '\u00E8': 'e', '\u00EA': 'e', '\u00EB': 'e',
        '\u00E0': 'a', '\u00E2': 'a', '\u00E7': 'c', '\u00EE': 'i', '\u00EF': 'i',
        '\u00F4': 'o', '\u00F9': 'u', '\u00FB': 'u', '\u00FC': 'u',
      };
      return map[ch] || '';
    });

    // Render a line with inline **bold** and *italic* markdown
    const drawFormattedLine = (rawLine: string, size: number, xStart: number, align: string, baseFont = font) => {
      // Strip markdown for width calculation, then render segments
      const plainText = rawLine.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
      const lineWidth = baseFont.widthOfTextAtSize(plainText, size);
      const maxWidth = width - 2 * margin;

      // Alignment
      let x: number;
      if (align === 'center') x = margin + (maxWidth - lineWidth) / 2;
      else if (align === 'right') x = width - margin - lineWidth;
      else x = xStart; // left or justify (justify uses left for now)

      // Parse segments: **bold**, *italic*, plain
      const segments: { text: string; bold: boolean; italic: boolean }[] = [];
      let remaining = rawLine;
      while (remaining.length > 0) {
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        const italicMatch = remaining.match(/^\*(.+?)\*/);
        if (boldMatch) {
          segments.push({ text: boldMatch[1], bold: true, italic: false });
          remaining = remaining.slice(boldMatch[0].length);
        } else if (italicMatch && !remaining.startsWith('**')) {
          segments.push({ text: italicMatch[1], bold: false, italic: true });
          remaining = remaining.slice(italicMatch[0].length);
        } else {
          // Plain text until next marker
          const nextMarker = remaining.slice(1).search(/\*/);
          const chunk = nextMarker === -1 ? remaining : remaining.slice(0, nextMarker + 1);
          segments.push({ text: chunk, bold: false, italic: false });
          remaining = remaining.slice(chunk.length);
        }
      }

      addNewPageIfNeeded(size + 4);
      for (const seg of segments) {
        const segFont = seg.bold ? fontBold : baseFont;
        const segText = sanitize(seg.text);
        page.drawText(segText, { x, y, size, font: segFont, color: rgb(0, 0, 0) });
        x += segFont.widthOfTextAtSize(segText, size);
      }
      y -= size + 4;
    };

    const drawText = (
      text: string,
      size: number,
      f = font,
      color = rgb(0, 0, 0),
      align = 'left',
    ) => {
      const maxWidth = width - 2 * margin;
      const safeText = sanitize(text);
      const paragraphs = safeText.split(/\r?\n/);
      for (let pi = 0; pi < paragraphs.length; pi++) {
        const para = paragraphs[pi];
        if (para.trim() === '') {
          y -= size + 2;
          addNewPageIfNeeded(size + 4);
          continue;
        }

        // Bullet list support
        const isBullet = para.match(/^[-*]\s+(.*)$/);
        const bulletIndent = isBullet ? 15 : 0;
        const lineText = isBullet ? isBullet[1] : para;
        const lineMaxWidth = maxWidth - bulletIndent;

        if (isBullet) {
          addNewPageIfNeeded(size + 4);
          page.drawText('\u2022', { x: margin + 4, y, size, font: f, color });
        }

        // Word wrap
        const words = lineText.split(' ');
        let line = '';
        let isFirstLine = true;
        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const plainTest = testLine.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
          const testWidth = f.widthOfTextAtSize(plainTest, size);
          if (testWidth > lineMaxWidth && line) {
            drawFormattedLine(line, size, margin + bulletIndent, isFirstLine ? align : (align === 'center' ? 'center' : 'left'), f);
            line = word;
            isFirstLine = false;
          } else {
            line = testLine;
          }
        }
        if (line) {
          drawFormattedLine(line, size, margin + bulletIndent, align, f);
        }
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

    // Variable replacement function — works everywhere in the document
    const dateStr = signedAt.toLocaleDateString('fr-FR') + ' a ' + signedAt.toLocaleTimeString('fr-FR');
    const replaceVars = (text: string): string => {
      if (!text) return text;
      if (participant) {
        for (const [key, value] of Object.entries(participant.data)) {
          text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''));
        }
      }
      text = text.replace(/\{signedAt\}/g, dateStr);
      return text;
    };

    // Document title — positioned left, center or right
    const titlePos = documentDef.titlePosition || 'center';
    const titleSize = 18;
    const titleText = sanitize(replaceVars(documentDef.title || ''));
    const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
    let titleX: number;
    if (titlePos === 'left') titleX = margin;
    else if (titlePos === 'right') titleX = width - margin - titleWidth;
    else titleX = (width - titleWidth) / 2;

    addNewPageIfNeeded(titleSize + 4);
    page.drawText(titleText, { x: titleX, y, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });
    y -= titleSize + 16;

    // Notice sections
    const sections = Array.isArray(documentDef.noticeSections)
      ? documentDef.noticeSections
      : JSON.parse(documentDef.noticeSections || '[]');
    for (const section of sections) {
      addNewPageIfNeeded(40);
      const sectionAlign = section.align || 'left';
      if (section.title) drawText(replaceVars(section.title), 11, fontBold, rgb(0, 0, 0), 'left');
      if (section.content) drawText(replaceVars(section.content), 9, font, rgb(0, 0, 0), sectionAlign);
      y -= 8;
    }

    // Declaration (skip if empty)
    const declaration = replaceVars(documentDef.declarationTemplate || '').trim();
    if (declaration) {
      y -= 8;
      drawText(declaration, 10, font, rgb(0, 0, 0), documentDef.declarationAlign || 'left');
      y -= 12;
    }

    // Signature image
    if (signatureData) {
      try {
        const base64 = signatureData.replace(/^data:image\/png;base64,/, '');
        const sigBytes = Buffer.from(base64, 'base64');
        const sigImage = await doc.embedPng(sigBytes);
        const sigWidth = (documentDef.signatureWidthMm / 25.4) * 72;
        const sigHeight = (documentDef.signatureHeightMm / 25.4) * 72;
        const pos = documentDef.signaturePosition || 'left';
        let sigX = margin;
        if (pos === 'center') sigX = (width - sigWidth) / 2;
        else if (pos === 'right') sigX = width - margin - sigWidth;
        addNewPageIfNeeded(sigHeight + 12);
        page.drawImage(sigImage, {
          x: sigX,
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
        p.drawText(sanitize(replaceVars(documentDef.pdfFooterText)), {
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
    const unprotected = Buffer.from(pdfBytes);

    // Protect PDF: AES-256 encryption, allow print only
    try {
      return await this.protectPdf(unprotected);
    } catch (err) {
      this.logger.warn(`PDF protection failed, returning unprotected: ${err}`);
      return unprotected;
    }
  }

  private async protectPdf(pdfBuffer: Buffer): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const id = crypto.randomUUID();
    const inputPath = path.join(tmpDir, `checkflow-${id}-in.pdf`);
    const outputPath = path.join(tmpDir, `checkflow-${id}-out.pdf`);

    try {
      fs.writeFileSync(inputPath, pdfBuffer);

      const ownerPassword = crypto.randomBytes(32).toString('hex');

      await encrypt({
        input: inputPath,
        output: outputPath,
        password: { user: '', owner: ownerPassword },
        keyLength: 256,
        restrictions: {
          print: 'full',
          modify: 'none',
          extract: 'n',
          annotate: 'n',
          useAes: 'y',
        },
      });

      const protectedPdf = fs.readFileSync(outputPath);
      this.logger.log('PDF protected with AES-256 (print allowed, modify/extract blocked)');
      return protectedPdf;
    } finally {
      // Cleanup temp files
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    }
  }
}
