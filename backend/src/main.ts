import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production' && allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
