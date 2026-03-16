import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { EmbeddingService } from './embedding.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, EmbeddingService],
  exports: [IntelligenceService, EmbeddingService],
})
export class IntelligenceModule {}
