import * as path from 'path';
import { config } from 'dotenv';

// Load .env from backend directory (works when running from monorepo root)
config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true }); // Allow frontend and mobile to call API
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
