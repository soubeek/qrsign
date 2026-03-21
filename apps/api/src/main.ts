import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false, // disable CSP in dev (Vite HMR)
    crossOriginEmbedderPolicy: isProduction,
  }));

  // CORS
  app.enableCors({
    origin: isProduction
      ? (config.get('CORS_ORIGINS') || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      : true,
    credentials: true,
  });

  await app.listen(3000, '0.0.0.0');
  Logger.log(`CheckFlow API running on port 3000 (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'})`, 'Bootstrap');
}
bootstrap();
