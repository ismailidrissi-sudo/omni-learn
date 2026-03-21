import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EmailPriority } from './constants';
import {
  verificationEmailHtml,
  verificationEmailSubject,
  enrollmentManagerNotificationHtml,
  enrollmentManagerNotificationSubject,
} from './templates';
import { accountActivatedHtml, accountActivatedSubject } from './templates/account-activated.template';
import {
  passwordResetRequestHtml,
  passwordResetRequestSubject,
} from './templates/password-reset.template';
import {
  passwordResetSuccessHtml,
  passwordResetSuccessSubject,
} from './templates/password-reset-success.template';
import {
  accountApprovedHtml,
  accountApprovedSubject,
  accountRejectedHtml,
  accountRejectedSubject,
  adminNewSignupReviewHtml,
  adminNewSignupReviewSubject,
} from './templates/org-affiliation.template';
import { enrollmentConfirmedHtml, enrollmentConfirmedSubject } from './templates/enrollment-confirmed.template';
import {
  completionCertificateHtml,
  completionCertificateSubject,
} from './templates/completion-certificate.template';
import {
  newLearningPathPublishedHtml,
  newLearningPathPublishedSubject,
} from './templates/new-learning-path.template';

/** Event types that must always send (security / account recovery) */
const ALWAYS_SEND = new Set([
  'password_reset_request',
  'password_reset_success',
  'email_verification',
]);

@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  private baseUrl(): string {
    return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  /**
   * Respects `user_email_preferences` for optional / marketing-style events.
   * Bulk sends use: `admin_campaign`, `scheduled_broadcast`, `weekly_digest` — all honor global `all` opt-out
   * and per-event toggles (see {@link UserEmailPreference}).
   */
  async canSend(userId: string | undefined, eventType: string): Promise<boolean> {
    if (!userId || ALWAYS_SEND.has(eventType)) {
      return true;
    }
    const db = this.prisma as any;
    const allOff = await db.userEmailPreference.findUnique({
      where: { userId_eventType: { userId, eventType: 'all' } },
    });
    if (allOff && !allOff.isEnabled) {
      return false;
    }
    const row = await db.userEmailPreference.findUnique({
      where: { userId_eventType: { userId, eventType } },
    });
    if (row && !row.isEnabled) {
      return false;
    }
    return true;
  }

  async sendEmailVerification(params: {
    toEmail: string;
    toName: string;
    userId: string;
    verifyToken: string;
  }): Promise<void> {
    const verifyUrl = `${this.baseUrl()}/verify-email?token=${encodeURIComponent(params.verifyToken)}`;
    const day = new Date().toISOString().split('T')[0];
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: verificationEmailSubject(),
      htmlBody: verificationEmailHtml(params.toName, verifyUrl),
      emailType: 'verification',
      eventType: 'email_verification',
      priority: EmailPriority.CRITICAL,
      triggeredBy: 'email_verification',
      userId: params.userId,
      idempotencyKey: `email_verification:${params.userId}:${day}`,
      metadata: { verifyUrl },
    });
  }

  async sendAccountActivated(params: { userId: string; toEmail: string; toName: string }): Promise<void> {
    if (!(await this.canSend(params.userId, 'account_activated'))) return;
    const loginUrl = `${this.baseUrl()}/signin?verified=true`;
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: accountActivatedSubject(),
      htmlBody: accountActivatedHtml(params.toName, loginUrl),
      emailType: 'welcome',
      eventType: 'account_activated',
      priority: EmailPriority.HIGH,
      triggeredBy: 'account_activated',
      userId: params.userId,
      idempotencyKey: `account_activated:${params.userId}`,
      metadata: { loginUrl },
    });
  }

  async sendPasswordResetRequest(params: {
    toEmail: string;
    toName: string;
    userId: string;
    rawToken: string;
  }): Promise<void> {
    const resetUrl = `${this.baseUrl()}/signin?resetToken=${encodeURIComponent(params.rawToken)}`;
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: passwordResetRequestSubject(),
      htmlBody: passwordResetRequestHtml(resetUrl),
      emailType: 'password_reset',
      eventType: 'password_reset_request',
      priority: EmailPriority.CRITICAL,
      triggeredBy: 'password_reset_request',
      userId: params.userId,
      metadata: {},
    });
  }

  async sendPasswordResetSuccess(params: { userId: string; toEmail: string; toName: string }): Promise<void> {
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: passwordResetSuccessSubject(),
      htmlBody: passwordResetSuccessHtml(params.toName),
      emailType: 'password_reset',
      eventType: 'password_reset_success',
      priority: EmailPriority.HIGH,
      triggeredBy: 'password_reset_success',
      userId: params.userId,
    });
  }

  async sendAccountApproved(params: {
    userId: string;
    toEmail: string;
    toName: string;
    tenantName: string;
  }): Promise<void> {
    if (!(await this.canSend(params.userId, 'account_approved'))) return;
    const loginUrl = `${this.baseUrl()}/signin?approved=true`;
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: accountApprovedSubject(params.tenantName),
      htmlBody: accountApprovedHtml(params.toName, loginUrl, params.tenantName),
      emailType: 'transactional',
      eventType: 'account_approved',
      priority: EmailPriority.HIGH,
      triggeredBy: 'org_approve',
      userId: params.userId,
      idempotencyKey: `account_approved:${params.userId}`,
    });
  }

  async sendAccountRejected(params: {
    userId: string;
    toEmail: string;
    toName: string;
    reason?: string;
  }): Promise<void> {
    if (!(await this.canSend(params.userId, 'account_rejected'))) return;
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: accountRejectedSubject(),
      htmlBody: accountRejectedHtml(params.toName, params.reason),
      emailType: 'transactional',
      eventType: 'account_rejected',
      priority: EmailPriority.NORMAL,
      triggeredBy: 'org_reject',
      userId: params.userId,
    });
  }

  async notifyCompanyAdminsNewSignup(params: {
    tenantId: string;
    learnerName: string;
    learnerEmail: string;
  }): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId: params.tenantId,
        companyAdminApprovedAt: { not: null },
        emailVerified: true,
      },
      select: { id: true, email: true, name: true },
    });
    const reviewUrl = `${this.baseUrl()}/profile/org-affiliation-requests?tenantId=${encodeURIComponent(params.tenantId)}`;
    for (const admin of admins) {
      if (!(await this.canSend(admin.id, 'admin_new_signup_review'))) continue;
      await this.emailService.enqueue({
        toEmail: admin.email,
        toName: admin.name,
        subject: adminNewSignupReviewSubject(params.learnerName),
        htmlBody: adminNewSignupReviewHtml(admin.name, params.learnerName, params.learnerEmail, reviewUrl),
        emailType: 'notification',
        eventType: 'admin_new_signup_review',
        priority: EmailPriority.HIGH,
        triggeredBy: 'signup_tenant_pending',
        userId: admin.id,
        metadata: { learnerEmail: params.learnerEmail },
      });
    }
    if (admins.length === 0) {
      this.logger.warn(`No company admins to notify for tenant ${params.tenantId}`);
    }
  }

  async sendEnrollmentConfirmed(params: {
    userId: string;
    toEmail: string;
    toName: string;
    contentTitle: string;
    contentType: 'course' | 'path';
    contentId: string;
    enrolledBy: 'self' | 'admin';
    assignerName?: string;
  }): Promise<void> {
    if (!(await this.canSend(params.userId, 'enrollment_confirmed'))) return;
    const startUrl =
      params.contentType === 'course'
        ? `${this.baseUrl()}/content/${encodeURIComponent(params.contentId)}`
        : `${this.baseUrl()}/learn?pathId=${encodeURIComponent(params.contentId)}`;
    const assignedByLabel =
      params.enrolledBy === 'admin' && params.assignerName
        ? params.assignerName
        : undefined;
    const eventType =
      params.enrolledBy === 'admin' ? 'enrollment_assigned' : 'enrollment_confirmed';
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: enrollmentConfirmedSubject(params.contentTitle),
      htmlBody: enrollmentConfirmedHtml(
        params.toName,
        params.contentTitle,
        params.contentType,
        startUrl,
        assignedByLabel,
      ),
      emailType: 'course_enrollment',
      eventType,
      priority: EmailPriority.NORMAL,
      triggeredBy: 'enrollment',
      userId: params.userId,
      idempotencyKey: `enrollment:${params.userId}:${params.contentType}:${params.contentId}`,
      metadata: { contentId: params.contentId, contentType: params.contentType },
    });
  }

  /** Sent when a certificate is first issued for a completed course or learning path */
  async sendCompletionCertificateEmail(params: {
    userId: string;
    toEmail: string;
    toName: string;
    contentTitle: string;
    contentType: 'course' | 'path';
    verifyCode: string;
    certificateId: string;
    downloadUrl?: string;
  }): Promise<void> {
    const eventType = params.contentType === 'course' ? 'course_completed' : 'path_completed';
    if (!(await this.canSend(params.userId, eventType))) {
      return;
    }
    const verifyUrl = `${this.baseUrl()}/certificates/verify/${encodeURIComponent(params.verifyCode)}`;
    const walletUrl = `${this.baseUrl()}/certificates`;
    const contentLabel = params.contentType === 'course' ? 'course' : 'learning path';
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: completionCertificateSubject(params.contentTitle),
      htmlBody: completionCertificateHtml({
        name: params.toName,
        contentTitle: params.contentTitle,
        contentLabel,
        verifyUrl,
        walletUrl,
        downloadUrl: params.downloadUrl,
      }),
      emailType: 'certificate',
      eventType,
      priority: EmailPriority.HIGH,
      triggeredBy: 'certificate_issued',
      userId: params.userId,
      idempotencyKey: `completion:${params.certificateId}`,
      metadata: {
        certificateId: params.certificateId,
        verifyCode: params.verifyCode,
        contentType: params.contentType,
      },
    });
  }

  async sendNewLearningPathPublishedEmail(params: {
    userId: string;
    toEmail: string;
    toName: string;
    pathName: string;
    domainName: string;
    pathId: string;
  }): Promise<void> {
    if (!(await this.canSend(params.userId, 'new_content_in_category'))) {
      return;
    }
    const exploreUrl = `${this.baseUrl()}/learn?pathId=${encodeURIComponent(params.pathId)}`;
    await this.emailService.enqueue({
      toEmail: params.toEmail,
      toName: params.toName,
      subject: newLearningPathPublishedSubject(params.pathName),
      htmlBody: newLearningPathPublishedHtml({
        name: params.toName,
        pathName: params.pathName,
        domainName: params.domainName,
        exploreUrl,
      }),
      emailType: 'notification',
      eventType: 'new_content_in_category',
      priority: EmailPriority.NORMAL,
      triggeredBy: 'path_published',
      userId: params.userId,
      idempotencyKey: `new_content:path:${params.pathId}:${params.userId}`,
      metadata: { pathId: params.pathId },
    });
  }

  async sendEnrollmentManagerNotification(params: {
    managerId: string;
    managerEmail: string;
    managerName: string;
    userName: string;
    contentTitle: string;
    contentType: string;
    tenantId?: string;
  }): Promise<void> {
    if (!(await this.canSend(params.managerId, 'enrollment_manager_notification'))) return;
    await this.emailService.enqueue({
      toEmail: params.managerEmail,
      toName: params.managerName,
      subject: enrollmentManagerNotificationSubject(params.userName, params.contentTitle),
      htmlBody: enrollmentManagerNotificationHtml(
        params.userName,
        params.contentTitle,
        params.contentType,
      ),
      emailType: 'notification',
      eventType: 'enrollment_manager_notification',
      priority: EmailPriority.NORMAL,
      triggeredBy: 'enrollment_manager_notification',
      userId: params.managerId,
      metadata: {
        userName: params.userName,
        contentTitle: params.contentTitle,
        contentType: params.contentType,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
    });
  }
}
