import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { EmbeddingService } from './embedding.service';

@Module({
  controllers: [IntelligenceController],
  providers: [IntelligenceService, EmbeddingService],
  exports: [IntelligenceService, EmbeddingService],
})
export class IntelligenceModule {}
