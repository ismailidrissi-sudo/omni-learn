import { Module } from '@nestjs/common';
import { SitePagesService } from './site-pages.service';
import { SitePagesController } from './site-pages.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SitePagesController],
  providers: [SitePagesService],
  exports: [SitePagesService],
})
export class SitePagesModule {}
