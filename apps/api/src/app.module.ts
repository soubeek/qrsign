import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env', '../../.env'] }),
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
