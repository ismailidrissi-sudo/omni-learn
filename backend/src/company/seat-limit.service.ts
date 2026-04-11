import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrgApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TxClient = Prisma.TransactionClient;

interface TenantSettings {
  maxUsers?: number;
  [key: string]: unknown;
}

@Injectable()
export class SeatLimitService {
  private readonly log = new Logger(SeatLimitService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assert that the tenant has not exceeded its seat cap.
   * Uses SELECT ... FOR UPDATE when inside a transaction to prevent concurrent over-allocation.
   * @param tenantId       target tenant
   * @param additionalSeats how many new seats are being claimed (default 1)
   * @param tx             optional Prisma transaction client for atomic checks
   * @throws NotFoundException when tenantId does not exist
   * @throws 402 Payment Required when seats are exhausted
   */
  async assertSeatAvailable(
    tenantId: string,
    additionalSeats = 1,
    tx?: TxClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;

    // Lock the tenant row if inside a transaction to serialize concurrent seat checks
    let tenant: { settings: unknown; name: string } | null;
    if (tx) {
      const rows = await tx.$queryRaw<Array<{ settings: unknown; name: string }>>`
        SELECT settings, name FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE
      `;
      tenant = rows[0] ?? null;
    } else {
      tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true, name: true },
      });
    }

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const settings = (tenant.settings ?? {}) as TenantSettings;
    const maxUsers = settings.maxUsers;
    if (maxUsers == null || maxUsers <= 0) return; // unlimited

    const currentApproved = await db.user.count({
      where: {
        tenantId,
        orgApprovalStatus: OrgApprovalStatus.APPROVED,
      },
    });

    if (currentApproved + additionalSeats > maxUsers) {
      this.log.warn(
        `Seat limit reached for tenant "${tenant.name}" (${currentApproved}/${maxUsers}, requested +${additionalSeats})`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Seat limit reached (${currentApproved}/${maxUsers}). Upgrade your plan or remove inactive users.`,
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
