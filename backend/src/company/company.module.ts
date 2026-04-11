import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { UserManagementController } from './user-management.controller';
import { AuthModule } from '../auth/auth.module';
import { SeatLimitService } from './seat-limit.service';
import { TenantCacheService } from './tenant-cache.service';

@Module({
  imports: [AuthModule],
  controllers: [CompanyController, UserManagementController],
  providers: [CompanyService, SeatLimitService, TenantCacheService],
  exports: [CompanyService, SeatLimitService, TenantCacheService],
})
export class CompanyModule {}
