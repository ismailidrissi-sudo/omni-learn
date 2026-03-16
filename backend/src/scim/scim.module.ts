import { Module } from '@nestjs/common';
import { ScimService } from './scim.service';
import { ScimController } from './scim.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ScimController],
  providers: [ScimService],
  exports: [ScimService],
})
export class ScimModule {}
