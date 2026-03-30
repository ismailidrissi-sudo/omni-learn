import { Injectable, Logger } from '@nestjs/common';
import { UserAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CsvExportService } from './csv-export.service';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class GeoScheduledReportService {
  private readonly log = new Logger(GeoScheduledReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly csv: CsvExportService,
    private readonly email: EmailService,
  ) {}

  /**
   * Sends a plain geographic CSV summary email to company admins per tenant.
   */
  async sendReportsForPeriod(from: Date, to: Date): Promise<{ tenants: number; emails: number }> {
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    let emails = 0;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    for (const t of tenants) {
      const filters: AnalyticsFiltersDto = { tenantId: t.id, from: fromStr, to: toStr };
      let csvText: string;
      try {
        csvText = await this.csv.exportGeo(filters);
      } catch (e) {
        this.log.warn(`exportGeo failed for tenant ${t.id}: ${e}`);
        continue;
      }

      const recipients = await this.prisma.user.findMany({
        where: {
          tenantId: t.id,
          OR: [{ companyAdminApprovedAt: { not: null } }, { isAdmin: true }],
          accountStatus: UserAccountStatus.ACTIVE,
        },
        select: { email: true },
      });

      const html = `
        <p>Geographic analytics for <strong>${escapeHtml(t.name)}</strong> (${fromStr} → ${toStr}).</p>
        <pre style="font-size:11px;white-space:pre-wrap;">${escapeHtml(csvText)}</pre>
      `;

      for (const r of recipients) {
        if (!r.email) continue;
        await this.email.enqueue({
          toEmail: r.email,
          subject: `omnilearn.space — Geographic Analytics Report (${t.name})`,
          htmlBody: html,
          textBody: csvText,
          emailType: 'geo_report',
          idempotencyKey: `geo-report:${t.id}:${fromStr}:${toStr}:${r.email}`,
        });
        emails += 1;
      }
    }

    this.log.log(`Geo report job: ${tenants.length} tenants, ${emails} emails queued`);
    return { tenants: tenants.length, emails };
  }
}
