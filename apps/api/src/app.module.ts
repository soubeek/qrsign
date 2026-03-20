import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { FieldsModule } from './fields/fields.module';
import { DocumentModule } from './document/document.module';
import { ParticipantsModule } from './participants/participants.module';
import { CheckinModule } from './checkin/checkin.module';
import { SigningModule } from './signing/signing.module';
import { EmailModule } from './email/email.module';
import { ExportModule } from './export/export.module';
import { AuditModule } from './audit/audit.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env', '../../.env'] }),
    // Rate limiting: 60 requests per minute globally, 5 per minute on login
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    FieldsModule,
    DocumentModule,
    ParticipantsModule,
    CheckinModule,
    SigningModule,
    EmailModule,
    ExportModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
