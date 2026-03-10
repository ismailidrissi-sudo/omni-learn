import { Module } from '@nestjs/common';
import { ScimService } from './scim.service';
import { ScimController } from './scim.controller';

@Module({
  controllers: [ScimController],
  providers: [ScimService],
  exports: [ScimService],
})
export class ScimModule {}
