import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.encryptionKey = this.config.get('EMAIL_ENCRYPTION_KEY') || '';
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text: string): string {
    if (!text || !text.includes(':')) return text; // Not encrypted, return as-is
    try {
      const [ivHex, encrypted] = text.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return text; // Fallback: return raw value if decryption fails
    }
  }

  private async createTransport(emailConfig: any) {
    const options: any = {
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpSecure,
      tls: { rejectUnauthorized: emailConfig.smtpRejectUnauthorized !== false },
    };
    if (emailConfig.smtpAuth !== false && emailConfig.smtpUser) {
      options.auth = { user: emailConfig.smtpUser, pass: this.decrypt(emailConfig.smtpPass || '') };
    }
    return nodemailer.createTransport(options);
  }

  async sendSignedDocument(participantId: string): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        event: { include: { fields: true } },
        signatures: { include: { documentDef: true } },
      },
    });
    if (!participant?.event) throw new Error('Participant not found');

    const emailConfig = await this.prisma.emailConfig.findFirst();
    if (!emailConfig) throw new Error('Email not configured');

    const emailField = participant.event.fields.find((f) => f.isEmailField);
    const data = participant.data as Record<string, any>;
    const recipientEmail = emailField ? data[emailField.key] : null;
    if (!recipientEmail)
      throw new Error('No email address for participant');

    const participantName =
      `${data['prenom'] || ''} ${data['nom'] || ''}`.trim();
    const transport = await this.createTransport(emailConfig);

    // Load template
    let templateSource: string;
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        'signed-document.hbs',
      );
      templateSource = fs.readFileSync(templatePath, 'utf8');
    } catch {
      templateSource =
        '<html><body><h2>{{eventTitle}}</h2><p>Bonjour {{participantName}},</p><div>{{{bodyContent}}}</div><p><em>Document signé en pièce jointe.</em></p></body></html>';
    }

    const vars = {
      participantName,
      eventTitle: participant.event.title,
      signedAt: (participant as any).signatures?.[0]?.signedAt?.toLocaleDateString('fr-FR') || new Date().toLocaleDateString('fr-FR'),
      organizationName: emailConfig.fromName,
    };

    const bodyTemplate = Handlebars.compile(
      emailConfig.bodyTemplate || 'Votre document signé est en pièce jointe.',
    );
    const bodyContent = bodyTemplate(vars);

    const htmlTemplate = Handlebars.compile(templateSource);
    const html = htmlTemplate({ ...vars, bodyContent });

    const subjectTemplate = Handlebars.compile(emailConfig.subject);
    const subject = subjectTemplate(vars);

    // Attach all signed PDFs
    const nomValue = data['nom'] || 'participant';
    const attachments: any[] = [];
    for (const sig of (participant as any).signatures || []) {
      if (sig.pdfPath && fs.existsSync(sig.pdfPath)) {
        const docTitle = sig.documentDef?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'document';
        attachments.push({
          filename: `${docTitle}_${nomValue}.pdf`,
          content: fs.readFileSync(sig.pdfPath),
          contentType: 'application/pdf',
        });
      }
    }

    await transport.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
      to: recipientEmail,
      subject,
      html,
      attachments,
    });

    await this.prisma.participant.update({
      where: { id: participantId },
      data: { emailSentAt: new Date() },
    });

    this.logger.log(`Email sent to ${recipientEmail} for ${participantId}`);
  }

  async sendTest(toAddress: string): Promise<void> {
    const emailConfig = await this.prisma.emailConfig.findFirst();
    if (!emailConfig) throw new Error('Email non configure. Sauvegardez d\'abord la configuration SMTP.');

    let transport;
    try {
      transport = await this.createTransport(emailConfig);
    } catch (e) {
      throw new Error('Erreur de configuration SMTP. Verifiez le mot de passe et re-sauvegardez la configuration.');
    }

    try {
      await transport.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
        to: toAddress,
        subject: `[TEST] ${emailConfig.subject}`,
        html: '<h1>Email de test</h1><p>La configuration SMTP est fonctionnelle.</p>',
      });
    } catch (e: any) {
      throw new Error(`Erreur SMTP : ${e.message}`);
    }
  }
}
