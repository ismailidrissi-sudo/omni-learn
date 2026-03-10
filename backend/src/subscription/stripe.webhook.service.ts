import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '@prisma/client';

/**
 * Stripe Webhook Service — Updates user plan on subscription events
 * omnilearn.space | Requires STRIPE_WEBHOOK_SECRET and Stripe SDK
 */

@Injectable()
export class StripeWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET not set — webhook verification skipped');
      return;
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });

    let event: { type: string; data: { object?: Record<string, unknown> } };
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      ) as unknown as { type: string; data: { object?: Record<string, unknown> } };
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      default:
        // Ignore other events
        break;
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Record<string, unknown> | undefined,
  ): Promise<void> {
    if (!subscription?.customer || !subscription?.id) return;
    const priceId = (subscription.items as { data?: Array<{ price?: { id?: string } }> })?.data?.[0]?.price?.id;
    const customerId = String(subscription.customer);
    const subscriptionId = String(subscription.id);
    const status = subscription.status as string;

    if (status !== 'active' && status !== 'trialing') return;

    const planId = this.mapPriceIdToPlan(priceId);
    const billingCycle = this.inferBillingCycle(subscription);

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        planId: planId as SubscriptionPlan,
        billingCycle: billingCycle as 'MONTHLY' | 'ANNUAL' | null,
        stripeSubscriptionId: subscriptionId,
      },
    });
  }

  private async handleSubscriptionDeleted(
    subscription: Record<string, unknown> | undefined,
  ): Promise<void> {
    if (!subscription?.customer) return;
    const customerId = String(subscription.customer);

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        planId: 'EXPLORER',
        billingCycle: null,
        stripeSubscriptionId: null,
      },
    });
  }

  private async handleInvoicePaid(
    invoice: Record<string, unknown> | undefined,
  ): Promise<void> {
    // Optional: sync on invoice.paid for extra reliability
    const subscriptionId = invoice?.subscription as string | undefined;
    if (!subscriptionId) return;
    // Could fetch subscription from Stripe and sync here
  }

  private mapPriceIdToPlan(priceId: string | undefined): SubscriptionPlan {
    if (!priceId) return 'EXPLORER';
    const monthlyPriceIds = (process.env.STRIPE_PRICE_SPECIALIST_MONTHLY || '').split(',');
    const annualPriceIds = (process.env.STRIPE_PRICE_SPECIALIST_ANNUAL || '').split(',');
    const visionaryMonthly = (process.env.STRIPE_PRICE_VISIONARY_MONTHLY || '').split(',');
    const visionaryAnnual = (process.env.STRIPE_PRICE_VISIONARY_ANNUAL || '').split(',');

    if (monthlyPriceIds.includes(priceId) || annualPriceIds.includes(priceId)) {
      return 'SPECIALIST';
    }
    if (visionaryMonthly.includes(priceId) || visionaryAnnual.includes(priceId)) {
      return 'VISIONARY';
    }
    return 'EXPLORER';
  }

  private inferBillingCycle(
    subscription: Record<string, unknown>,
  ): 'MONTHLY' | 'ANNUAL' | null {
    const interval = (subscription.items as { data?: Array<{ plan?: { interval?: string } }> })?.data?.[0]?.plan?.interval;
    if (interval === 'year') return 'ANNUAL';
    if (interval === 'month') return 'MONTHLY';
    return null;
  }
}
