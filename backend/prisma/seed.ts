/**
 * Seed — Industries, Departments, Positions, Sample Users, Tenant, Domains
 * omnilearn.space | Afflatus Consulting Group
 */

import { PrismaClient } from '@prisma/client';

function lightenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + ((255 - ((num >> 16) & 0xff)) * percent) / 100);
  const g = Math.min(255, ((num >> 8) & 0xff) + ((255 - ((num >> 8) & 0xff)) * percent) / 100);
  const b = Math.min(255, (num & 0xff) + ((255 - (num & 0xff)) * percent) / 100);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

// SQLite stores Json as String; PostgreSQL jsonb accepts JSON strings. Serialize for both.
const jsonVal = <T>(obj: T): string => JSON.stringify(obj);
// Use local schema for SQLite: PrismaClient is generated from schema.local.prisma when db:setup:local is run
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'seed-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Seed industries
  for (const ind of data.industries) {
    await prisma.industry.upsert({
      where: { code: ind.code },
      create: { code: ind.code, name: ind.name, sector: ind.sector },
      update: { name: ind.name, sector: ind.sector },
    });
  }
  console.log(`Seeded ${data.industries.length} industries`);

  // Seed departments
  for (const dept of data.departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      create: { code: dept.code, name: dept.name },
      update: { name: dept.name },
    });
  }
  console.log(`Seeded ${data.departments.length} departments`);

  // Seed positions
  for (const pos of data.positions) {
    await prisma.position.upsert({
      where: { code: pos.code },
      create: { code: pos.code, name: pos.name },
      update: { name: pos.name },
    });
  }
  console.log(`Seeded ${data.positions.length} positions`);

  // Seed sample users (only if they don't exist)
  for (const u of data.users) {
    const dept = await prisma.department.findUnique({ where: { code: u.department } });
    const pos = await prisma.position.findUnique({ where: { code: u.position } });
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        departmentId: dept?.id,
        positionId: pos?.id,
      },
      update: {
        name: u.name,
        departmentId: dept?.id,
        positionId: pos?.id,
      },
    });
  }
  console.log(`Seeded ${data.users.length} users`);

  // Seed default tenant and domains (Dynamic Domain System per architecture)
  if (data.tenants?.length && data.domains?.length) {
    const t0 = data.tenants[0] as { name: string; slug: string; industryCode?: string; linkedinProfileUrl?: string; staffingLevel?: string; targetMarkets?: string[]; productsServices?: string[] };
    const industry = t0.industryCode ? await prisma.industry.findUnique({ where: { code: t0.industryCode } }) : null;
    const tenant = await prisma.tenant.upsert({
      where: { slug: t0.slug },
      create: {
        name: t0.name,
        slug: t0.slug,
        industryId: industry?.id,
        linkedinProfileUrl: t0.linkedinProfileUrl,
        companyProfileComplete: !!(t0.industryCode || t0.linkedinProfileUrl),
        staffingLevel: t0.staffingLevel,
        targetMarkets: t0.targetMarkets ? jsonVal(t0.targetMarkets) : undefined,
        productsServices: t0.productsServices ? jsonVal(t0.productsServices) : undefined,
      },
      update: {
        name: t0.name,
        industryId: industry?.id,
        linkedinProfileUrl: t0.linkedinProfileUrl,
        companyProfileComplete: !!(t0.industryCode || t0.linkedinProfileUrl),
        staffingLevel: t0.staffingLevel,
        ...(t0.targetMarkets && { targetMarkets: jsonVal(t0.targetMarkets) }),
        ...(t0.productsServices && { productsServices: jsonVal(t0.productsServices) }),
      },
    });
    console.log(`Seeded tenant: ${tenant.slug}`);

    for (const d of data.domains) {
      const domain = await prisma.domain.upsert({
        where: {
          tenantId_slug: { tenantId: tenant.id, slug: d.slug },
        },
        create: {
          tenantId: tenant.id,
          name: d.name,
          slug: d.slug,
          icon: d.icon,
          color: d.color,
          sortOrder: d.sortOrder ?? 0,
        },
        update: {
          name: d.name,
          icon: d.icon,
          color: d.color,
          sortOrder: d.sortOrder ?? 0,
        },
      });
      // Auto-create certificate template per architecture
      await prisma.certificateTemplate.upsert({
        where: {
          tenantId_domainId: { tenantId: tenant.id, domainId: domain.id },
        },
        create: {
          tenantId: tenant.id,
          domainId: domain.id,
          templateName: `${d.name} Certificate`,
          themeConfig: jsonVal({
            primary_color: d.color,
            secondary_color: lightenHex(d.color, 15),
            accent_color: '#c8a951',
            seal_text: `CERTIFIED ${d.name.toUpperCase().replace(/\s+/g, ' ')} PROFESSIONAL`,
            title_font: 'Playfair Display',
            body_font: 'Source Serif 4',
          }),
          elementsConfig: jsonVal({
            show_logo: true,
            show_qr: true,
            show_hours: true,
            show_grade: true,
            show_signature: true,
            show_seal: true,
            show_expiry: false,
            show_badge: false,
          }),
          signatories: jsonVal([]),
        },
        update: {},
      });
    }
    console.log(`Seeded ${data.domains.length} domains with certificate templates`);

    // Seed content items (brand story: courses, micro-learning, podcasts, guides)
    if (data.contentItems?.length) {
      const domainMap = new Map<string, string>();
      for (const d of data.domains) {
        const dom = await prisma.domain.findUnique({
          where: { tenantId_slug: { tenantId: tenant.id, slug: d.slug } },
        });
        if (dom) domainMap.set(d.slug, dom.id);
      }
      for (const c of data.contentItems) {
        const domainId = c.domainSlug ? domainMap.get(c.domainSlug) ?? null : null;
        const existing = await prisma.contentItem.findFirst({
          where: { title: c.title, domainId: domainId ?? undefined },
        });
        if (!existing) {
          const metadata = (c as { videoUrl?: string }).videoUrl
            ? jsonVal({ videoUrl: (c as { videoUrl: string }).videoUrl })
            : undefined;
          await prisma.contentItem.create({
            data: {
              type: c.type,
              title: c.title,
              domainId,
              durationMinutes: c.durationMinutes ?? null,
              metadata,
              mediaId: (c as { videoUrl?: string }).videoUrl ?? undefined,
              isFoundational: true,
            },
          });
        }
      }
      console.log(`Seeded ${data.contentItems.length} content items`);
    }

    // Seed learning paths with steps
    if (data.learningPaths?.length) {
      const domainMap = new Map<string, string>();
      for (const d of data.domains) {
        const dom = await prisma.domain.findUnique({
          where: { tenantId_slug: { tenantId: tenant.id, slug: d.slug } },
        });
        if (dom) domainMap.set(d.slug, dom.id);
      }
      for (const lp of data.learningPaths) {
        const domainId = domainMap.get(lp.domainSlug);
        if (!domainId) continue;
        const path = await prisma.learningPath.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: lp.slug } },
          create: {
            tenantId: tenant.id,
            domainId,
            name: lp.name,
            slug: lp.slug,
            description: lp.description ?? null,
            isPublished: true,
          },
          update: { name: lp.name, domainId, description: lp.description ?? undefined },
        });
        const contentTitles = lp.contentTitles ?? [];
        for (let i = 0; i < contentTitles.length; i++) {
          const content = await prisma.contentItem.findFirst({
            where: { title: contentTitles[i] },
          });
          if (content) {
            const stepExists = await prisma.learningPathStep.findFirst({
              where: { pathId: path.id, stepOrder: i + 1 },
            });
            if (!stepExists) {
              await prisma.learningPathStep.create({
                data: {
                  pathId: path.id,
                  contentItemId: content.id,
                  stepOrder: i + 1,
                  isRequired: true,
                },
              });
            }
          }
        }
      }
      console.log(`Seeded ${data.learningPaths.length} learning paths`);
    }
  }

  // Seed forum channels (global, not tenant-scoped)
  if (data.forumChannels?.length) {
    for (const ch of data.forumChannels) {
      const existing = await prisma.forumChannel.findFirst({
        where: { slug: ch.slug },
      });
      if (!existing) {
        await prisma.forumChannel.create({
          data: {
            name: ch.name,
            slug: ch.slug,
            description: ch.description ?? null,
          },
        });
      }
    }
    console.log(`Seeded ${data.forumChannels.length} forum channels`);
  }

  // Seed forum topics and posts
  if (data.forumTopics?.length) {
    const channelMap = new Map<string, string>();
    for (const ch of data.forumChannels ?? []) {
      const c = await prisma.forumChannel.findFirst({ where: { slug: ch.slug } });
      if (c) channelMap.set(ch.slug, c.id);
    }
    const userMap = new Map<string, string>();
    for (const u of data.users ?? []) {
      const usr = await prisma.user.findUnique({ where: { email: u.email } });
      if (usr) userMap.set(u.email, usr.id);
    }
    for (const t of data.forumTopics) {
      const channelId = channelMap.get(t.channelSlug);
      const authorId = userMap.get(t.authorEmail);
      if (!channelId || !authorId) continue;
      const existing = await prisma.forumTopic.findFirst({
        where: { channelId, title: t.title },
      });
      if (!existing) {
        await prisma.forumTopic.create({
          data: {
            channelId,
            authorId,
            title: t.title,
            body: t.body,
            status: 'OPEN',
          },
        });
      }
    }
    console.log(`Seeded ${data.forumTopics.length} forum topics`);
  }

  if (data.forumPosts?.length) {
    const channelMap = new Map<string, string>();
    for (const ch of data.forumChannels ?? []) {
      const c = await prisma.forumChannel.findFirst({ where: { slug: ch.slug } });
      if (c) channelMap.set(ch.slug, c.id);
    }
    const userMap = new Map<string, string>();
    for (const u of data.users ?? []) {
      const usr = await prisma.user.findUnique({ where: { email: u.email } });
      if (usr) userMap.set(u.email, usr.id);
    }
    for (const p of data.forumPosts) {
      const channelId = channelMap.get(p.channelSlug);
      const authorId = userMap.get(p.authorEmail);
      if (!channelId || !authorId) continue;
      const topic = await prisma.forumTopic.findFirst({
        where: { channelId, title: p.topicTitle },
      });
      if (!topic) continue;
      const existingPost = await prisma.forumPost.findFirst({
        where: { topicId: topic.id, body: p.body, authorId },
      });
      if (!existingPost) {
        await prisma.forumPost.create({
          data: {
            topicId: topic.id,
            authorId,
            body: p.body,
            status: 'VISIBLE',
          },
        });
      }
    }
    console.log(`Seeded ${data.forumPosts.length} forum posts`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
