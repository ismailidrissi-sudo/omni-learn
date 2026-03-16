import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

interface BulkImportDto {
  tenantId: string;
  users: { name: string; email: string; role?: string }[];
}

@Controller('company')
export class UserManagementController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('users/bulk-import')
  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN)
  async bulkImport(@Body() body: BulkImportDto) {
    if (!body.tenantId || !Array.isArray(body.users) || body.users.length === 0) {
      throw new BadRequestException('tenantId and users array are required');
    }

    if (body.users.length > 500) {
      throw new BadRequestException('Maximum 500 users per import');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: body.tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const existingEmails = new Set(
      (await this.prisma.user.findMany({
        where: { email: { in: body.users.map((u) => u.email.toLowerCase()) } },
        select: { email: true },
      })).map((u) => u.email.toLowerCase()),
    );

    const tempPassword = await bcrypt.hash('ChangeMeOnFirstLogin!', 10);
    let created = 0;
    let skipped = 0;

    for (const u of body.users) {
      const email = u.email.toLowerCase().trim();
      if (!email.includes('@') || existingEmails.has(email)) {
        skipped++;
        continue;
      }

      await this.prisma.user.create({
        data: {
          email,
          name: u.name?.trim() || email.split('@')[0],
          passwordHash: tempPassword,
          tenantId: body.tenantId,
          emailVerified: true,
          profileComplete: false,
        },
      });
      created++;
    }

    return { created, skipped, total: body.users.length };
  }
}
