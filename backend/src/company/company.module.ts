import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { UserManagementController } from './user-management.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CompanyController, UserManagementController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
