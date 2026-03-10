import { useState, useEffect } from "react";

/*
 * ═══════════════════════════════════════════════
 *   omnilearn.space — LMS Architecture Blueprint
 *   A product by Afflatus Consulting Group
 * ═══════════════════════════════════════════════
 */

// ── BRAND SYSTEM ──
const BRAND = {
  name: "omnilearn.space",
  tagline: "Every Skill. One Space.",
  parent: "Afflatus Consulting Group",
  colors: {
    cosmos: "#0b0f1e",       // deep space navy — primary bg
    nebula: "#151b33",       // lighter navy — card bg
    nova: "#6366f1",         // indigo — primary action
    novaLight: "#818cf8",    // lighter indigo
    pulsar: "#06d6a0",       // mint green — success/growth
    solar: "#fbbf24",        // warm gold — premium/accent
    comet: "#f43f5e",        // rose — alerts/energy
    stardust: "#94a3b8",     // muted silver — body text
    void: "#0f172a",         // near-black
    white: "#f1f5f9",
  },
};

const O = BRAND.colors;

// ── TECH STACK ──
const TECH_STACK = {
  frontend: [
    { tech: "Next.js 15 (App Router)", role: "Framework", why: "SSR/SSG for SEO, RSC for speed, middleware for RBAC routing, built-in API routes" },
    { tech: "TypeScript", role: "Language", why: "Type safety across the entire stack, better DX, fewer runtime errors" },
    { tech: "Tailwind CSS + Framer Motion", role: "Styling & Animation", why: "Utility-first CSS for rapid UI, Framer for premium micro-interactions and page transitions" },
    { tech: "Zustand + TanStack Query", role: "State Management", why: "Lightweight global state + server state caching with automatic invalidation" },
    { tech: "Radix UI + custom design system", role: "Components", why: "Accessible primitives, fully customizable — no vendor lock-in" },
    { tech: "HLS.js + Plyr", role: "Media Player", why: "Adaptive bitrate video streaming, podcast player with speed controls" },
  ],
  backend: [
    { tech: "NestJS (Node.js)", role: "API Framework", why: "Enterprise-grade, modular architecture, built-in guards for RBAC, GraphQL + REST support" },
    { tech: "GraphQL (Apollo Server)", role: "API Layer", why: "Flexible queries for complex content relationships, real-time subscriptions for discussions" },
    { tech: "Bull MQ + Redis", role: "Job Queue", why: "Background processing: video transcoding, certificate generation, email notifications" },
    { tech: "Socket.io", role: "Real-time", why: "Live discussions, notifications, collaborative features, moderation alerts" },
    { tech: "Meilisearch", role: "Search Engine", why: "Blazing fast full-text search with typo tolerance, faceted filtering for content discovery" },
    { tech: "MinIO / Cloudflare R2", role: "Object Storage", why: "S3-compatible, self-hosted option for document/media storage, CDN integration" },
  ],
  database: [
    { tech: "PostgreSQL 16", role: "Primary DB", why: "ACID compliance, JSONB for flexible content schemas, Row-Level Security for multi-tenancy" },
    { tech: "Prisma ORM", role: "Data Access", why: "Type-safe queries, migrations, visual studio — reduces SQL errors" },
    { tech: "Redis 7", role: "Cache + Sessions", why: "Sub-ms response for leaderboards, session management, rate limiting, real-time presence" },
    { tech: "pgvector extension", role: "AI/Embeddings", why: "Vector similarity search for AI-powered content recommendations and semantic search" },
  ],
  infra: [
    { tech: "Docker + Kubernetes", role: "Containerization", why: "Consistent deployments, horizontal scaling, zero-downtime updates" },
    { tech: "Cloudflare CDN + Workers", role: "Edge Network", why: "Global content delivery, edge caching for static assets, DDoS protection" },
    { tech: "Keycloak", role: "Identity Provider", why: "Enterprise SSO (SAML/OIDC), multi-tenant auth, social login, MFA" },
    { tech: "PostHog", role: "Analytics", why: "Self-hosted product analytics, session replay, feature flags — GDPR compliant" },
  ],
};

// ── RBAC ──
const RBAC_ROLES = [
  { role: "Super Admin", color: O.comet, permissions: "Full platform control, tenant management, system config, create/manage all learning paths" },
  { role: "Company Admin", color: "#fb923c", permissions: "Manage company users, assign learning paths to teams, view company analytics, configure branding" },
  { role: "Company Manager", color: O.solar, permissions: "Monitor team progress on paths, approve enrollments, export reports, manage groups" },
  { role: "Instructor", color: O.novaLight, permissions: "Create/edit courses, contribute content to paths, moderate discussions, view learner analytics" },
  { role: "Content Moderator", color: "#c084fc", permissions: "Review/approve UGC, moderate discussions, flag content, manage reported items" },
  { role: "Learner (Pro)", color: O.pulsar, permissions: "Access all learning paths, join discussions, earn certificates, track progress" },
  { role: "Learner (Basic)", color: O.stardust, permissions: "Access assigned paths only, basic micro-learning, restricted document access" },
];

// ── CONTENT TYPES ──
const CONTENT_TYPES = [
  { type: "Course", icon: "📚", color: "#3b82f6" },
  { type: "Micro-learning", icon: "⚡", color: O.solar },
  { type: "Podcast", icon: "🎧", color: "#8b5cf6" },
  { type: "Document", icon: "📄", color: O.stardust },
  { type: "Implementation Guide", icon: "🛠️", color: "#fb923c" },
  { type: "Quiz / Assessment", icon: "✅", color: O.pulsar },
  { type: "Game", icon: "🎮", color: "#ec4899" },
  { type: "Video", icon: "🎬", color: "#0891b2" },
];

// ── LEARNING PATHS ──
const SAMPLE_PATHS = [
  {
    id: 1, name: "ESG Foundations Mastery", domain: "ESG", difficulty: "Beginner → Intermediate",
    color: "#059669", icon: "🌍", duration: "8 weeks", enrolled: 234, completion: 78,
    description: "Complete journey from ESG fundamentals to reporting mastery. Covers GRI, SASB, TCFD frameworks with hands-on implementation.",
    steps: [
      { order: 1, title: "What is ESG? — The Big Picture", type: "Micro-learning", duration: "5 min", required: true },
      { order: 2, title: "ESG Frameworks Deep Dive", type: "Course", duration: "4 hours", required: true },
      { order: 3, title: "Interview: ESG Leaders on Real Impact", type: "Podcast", duration: "32 min", required: false },
      { order: 4, title: "ESG Fundamentals Check", type: "Quiz / Assessment", duration: "15 min", required: true },
      { order: 5, title: "GRI Standards Reference Guide", type: "Document", duration: "Read", required: false },
      { order: 6, title: "Building Your First ESG Report", type: "Implementation Guide", duration: "2 hours", required: true },
      { order: 7, title: "ESG Materiality Matrix Game", type: "Game", duration: "20 min", required: false },
      { order: 8, title: "Sustainability Metrics & KPIs", type: "Course", duration: "3 hours", required: true },
      { order: 9, title: "ESG Reporting Masterclass", type: "Video", duration: "45 min", required: true },
      { order: 10, title: "Final Assessment — ESG Practitioner", type: "Quiz / Assessment", duration: "30 min", required: true },
    ],
  },
  {
    id: 2, name: "HACCP & Food Safety Compliance", domain: "Food Safety", difficulty: "Intermediate",
    color: "#0891b2", icon: "🔬", duration: "6 weeks", enrolled: 189, completion: 82,
    description: "Master HACCP principles, ISO 22000 implementation, and food safety audit preparation.",
    steps: [
      { order: 1, title: "Food Safety Fundamentals Refresher", type: "Micro-learning", duration: "7 min", required: true },
      { order: 2, title: "HACCP 7 Principles — Complete Course", type: "Course", duration: "6 hours", required: true },
      { order: 3, title: "Hazard Analysis Worksheet", type: "Document", duration: "Read", required: true },
      { order: 4, title: "Building Your HACCP Plan", type: "Implementation Guide", duration: "3 hours", required: true },
      { order: 5, title: "Food Safety Scenario Challenge", type: "Game", duration: "25 min", required: false },
      { order: 6, title: "ISO 22000:2018 Deep Dive", type: "Course", duration: "5 hours", required: true },
      { order: 7, title: "Audit Preparation Checklist", type: "Document", duration: "Read", required: true },
      { order: 8, title: "Final Certification Exam", type: "Quiz / Assessment", duration: "45 min", required: true },
    ],
  },
  {
    id: 3, name: "Leadership & Influence Toolkit", domain: "Soft Skills", difficulty: "All Levels",
    color: "#7c3aed", icon: "🧠", duration: "5 weeks", enrolled: 312, completion: 71,
    description: "Develop essential leadership competencies through theory, reflection, and practical exercises.",
    steps: [
      { order: 1, title: "Leadership Styles Self-Assessment", type: "Quiz / Assessment", duration: "10 min", required: true },
      { order: 2, title: "Emotional Intelligence at Work", type: "Course", duration: "3 hours", required: true },
      { order: 3, title: "The Art of Difficult Conversations", type: "Podcast", duration: "28 min", required: false },
      { order: 4, title: "Conflict Resolution Simulator", type: "Game", duration: "30 min", required: true },
      { order: 5, title: "Giving Effective Feedback", type: "Micro-learning", duration: "6 min", required: true },
      { order: 6, title: "Team Dynamics & Motivation", type: "Course", duration: "4 hours", required: true },
      { order: 7, title: "Leadership Competency Final Exam", type: "Quiz / Assessment", duration: "20 min", required: true },
    ],
  },
  {
    id: 4, name: "Lean Six Sigma Green Belt", domain: "Operational Excellence", difficulty: "Intermediate → Advanced",
    color: "#ea580c", icon: "⚙️", duration: "10 weeks", enrolled: 156, completion: 65,
    description: "Full Green Belt certification: DMAIC methodology, statistical tools, and real project implementation.",
    steps: [
      { order: 1, title: "OpEx Mindset — Why Continuous Improvement?", type: "Micro-learning", duration: "5 min", required: true },
      { order: 2, title: "DMAIC Define Phase", type: "Course", duration: "4 hours", required: true },
      { order: 3, title: "DMAIC Measure & Analyze", type: "Course", duration: "6 hours", required: true },
      { order: 4, title: "Statistical Tools Reference", type: "Document", duration: "Read", required: true },
      { order: 5, title: "Process Mapping Workshop", type: "Implementation Guide", duration: "2 hours", required: true },
      { order: 6, title: "DMAIC Improve & Control", type: "Course", duration: "5 hours", required: true },
      { order: 7, title: "Waste Identification Game", type: "Game", duration: "20 min", required: false },
      { order: 8, title: "Green Belt Certification Exam", type: "Quiz / Assessment", duration: "60 min", required: true },
    ],
  },
  {
    id: 5, name: "Digital Marketing Accelerator", domain: "Marketing", difficulty: "Beginner → Intermediate",
    color: "#e11d48", icon: "📈", duration: "4 weeks", enrolled: 278, completion: 74,
    description: "Fast-track digital marketing skills from strategy to execution, with focus on analytics and ROI.",
    steps: [
      { order: 1, title: "Digital Marketing Landscape 2025", type: "Micro-learning", duration: "7 min", required: true },
      { order: 2, title: "Content Strategy & SEO Mastery", type: "Course", duration: "4 hours", required: true },
      { order: 3, title: "Marketing Analytics Dashboard", type: "Implementation Guide", duration: "1.5 hours", required: true },
      { order: 4, title: "Growth Hacking Tactics", type: "Podcast", duration: "35 min", required: false },
      { order: 5, title: "Campaign ROI Calculator", type: "Document", duration: "Read", required: false },
      { order: 6, title: "A/B Testing Challenge", type: "Game", duration: "15 min", required: true },
      { order: 7, title: "Final Assessment — Digital Marketer", type: "Quiz / Assessment", duration: "25 min", required: true },
    ],
  },
];

const FEATURES = {
  core: ["Course Builder (SCORM/xAPI)", "Micro-learning engine (3–7 min)", "Podcast hosting + transcripts", "Document library + version control", "Interactive implementation guides", "Gamification (points, badges, streaks)", "Certificate generation (PDF + QR)", "Learning path builder + prerequisites"],
  social: ["Course ratings & reviews", "Discussion forums per course", "Peer-to-peer knowledge sharing", "Moderated community groups", "Content bookmarking & sharing", "Expert Q&A sessions", "Activity feed + engagement", "Mentorship matching"],
  enterprise: ["Multi-tenant architecture", "Custom branding per company", "SSO (SAML 2.0, OIDC)", "Compliance tracking + audit logs", "Advanced analytics + reporting", "API access for integrations", "Bulk provisioning (SCIM)", "White-label deployment"],
};

const DOMAINS = [
  { name: "ESG", icon: "🌍", color: "#059669" },
  { name: "Food Safety", icon: "🔬", color: "#0891b2" },
  { name: "Soft Skills", icon: "🧠", color: "#7c3aed" },
  { name: "Operational Excellence", icon: "⚙️", color: "#ea580c" },
  { name: "Marketing", icon: "📈", color: "#e11d48" },
];

// ── TABS ──
const TABS = ["Brand", "Tech Stack", "Architecture", "RBAC", "Learning Paths", "Admin Panel", "Features", "Database", "Roadmap"];

// ── HELPERS ──
const Badge = ({ children, color = "#475569", bg }) => (
  <span style={{ fontSize: 10, fontWeight: 600, color, background: bg || `${color}18`, padding: "2px 8px", borderRadius: 4 }}>{children}</span>
);

// ── LOGO COMPONENT ──
function OmnilearnLogo({ size = "md" }) {
  const s = size === "lg" ? { box: 48, text: 28, dot: 9 } : size === "md" ? { box: 38, text: 20, dot: 7 } : { box: 28, text: 14, dot: 5 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size === "lg" ? 14 : 10 }}>
      <div style={{
        width: s.box, height: s.box, borderRadius: s.box * 0.28,
        background: `linear-gradient(135deg, ${O.nova} 0%, ${O.pulsar} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 20px ${O.nova}40`,
        position: "relative",
      }}>
        <span style={{ fontSize: s.text, fontWeight: 900, color: "#fff", letterSpacing: -1.5 }}>O</span>
        <div style={{
          position: "absolute", top: -2, right: -2, width: s.dot, height: s.dot,
          borderRadius: "50%", background: O.solar,
          boxShadow: `0 0 8px ${O.solar}80`,
        }} />
      </div>
      <div>
        <div style={{ fontSize: size === "lg" ? 22 : size === "md" ? 16 : 13, fontWeight: 800, color: "#fff", letterSpacing: -0.5, lineHeight: 1.1 }}>
          omnilearn<span style={{ color: O.pulsar }}>.space</span>
        </div>
        {size !== "sm" && (
          <div style={{ fontSize: size === "lg" ? 11 : 9, color: O.stardust, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
            by Afflatus Consulting Group
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ──
export default function OmnilearnBlueprint() {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedTech, setExpandedTech] = useState(null);
  const [selectedPath, setSelectedPath] = useState(0);
  const [adminView, setAdminView] = useState("list");
  const [builderSteps, setBuilderSteps] = useState([
    { id: 1, title: "Introduction to Quality Management", type: "Micro-learning", duration: "5 min", required: true },
    { id: 2, title: "ISO 9001:2015 Complete Course", type: "Course", duration: "8 hours", required: true },
    { id: 3, title: "QMS Documentation Templates", type: "Document", duration: "Read", required: true },
  ]);
  const [pathName, setPathName] = useState("ISO 9001 QMS Implementation");
  const [pathDomain, setPathDomain] = useState("Operational Excellence");

  const addStep = (type) => {
    setBuilderSteps(prev => [...prev, { id: Date.now(), title: `New ${type}`, type, duration: type === "Course" ? "4 hours" : "15 min", required: false }]);
  };
  const removeStep = (id) => setBuilderSteps(prev => prev.filter(s => s.id !== id));
  const toggleRequired = (id) => setBuilderSteps(prev => prev.map(s => s.id === id ? { ...s, required: !s.required } : s));
  const moveStep = (from, to) => { if (to < 0 || to >= builderSteps.length) return; const a = [...builderSteps]; const [i] = a.splice(from, 1); a.splice(to, 0, i); setBuilderSteps(a); };

  const currentPath = SAMPLE_PATHS[selectedPath];
  const card = { background: `${O.nebula}`, border: `1px solid rgba(99,102,241,0.08)`, borderRadius: 12 };
  const glow = (c) => ({ background: `${c}0a`, border: `1px solid ${c}25`, borderRadius: 12 });

  return (
    <div style={{ fontFamily: "'Satoshi', 'DM Sans', 'Segoe UI', system-ui, sans-serif", background: O.cosmos, color: O.white, minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(180deg, ${O.cosmos} 0%, ${O.nebula} 100%)`,
        borderBottom: `1px solid rgba(99,102,241,0.1)`,
        padding: "24px 24px 0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Subtle grid */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1160, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <OmnilearnLogo size="lg" />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge color={O.pulsar} bg={`${O.pulsar}15`}>v2.0</Badge>
              <Badge color={O.stardust}>Architecture Blueprint</Badge>
            </div>
          </div>
          <p style={{ fontSize: 13, color: O.stardust, marginBottom: 16, maxWidth: 700 }}>
            {BRAND.tagline} — Enterprise LMS with Learning Paths, micro-learning, podcasts, implementation guides, gamification, and social learning for corporate professionals.
          </p>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} style={{
                padding: "9px 16px", fontSize: 12, fontWeight: activeTab === i ? 700 : 500,
                color: activeTab === i ? O.pulsar : "#4b5574",
                background: activeTab === i ? `${O.pulsar}0c` : "transparent",
                border: "none", borderBottom: activeTab === i ? `2px solid ${O.pulsar}` : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.2s",
              }}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 24px 60px" }}>

        {/* ═══ TAB 0: BRAND ═══ */}
        {activeTab === 0 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Brand Identity</h2>
            <p style={{ fontSize: 13, color: O.stardust, marginBottom: 24 }}>omnilearn.space — the complete professional learning universe by Afflatus Consulting Group.</p>

            {/* Logo showcase */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
              {["lg", "md", "sm"].map((size, i) => (
                <div key={size} style={{ ...card, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <OmnilearnLogo size={size} />
                </div>
              ))}
            </div>

            {/* Brand meaning */}
            <div style={{ ...glow(O.nova), padding: 22, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: O.novaLight, marginTop: 0, marginBottom: 10 }}>Why "omnilearn.space"?</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { word: "omni", meaning: "Latin for 'all, every' — signals comprehensive coverage across ESG, Food Safety, Soft Skills, OpEx, and Marketing. One platform, every domain.", color: O.nova },
                  { word: "learn", meaning: "Direct, action-oriented. No ambiguity about purpose. Professionals come here to grow. Courses, micro-learning, podcasts, games — all modes of learning.", color: O.pulsar },
                  { word: ".space", meaning: "The domain extension doubles as brand language — this is your space to learn. Evokes openness, exploration, and a modern tech-forward identity.", color: O.solar },
                ].map((w, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: w.color, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>{w.word}</div>
                    <p style={{ fontSize: 12, color: O.stardust, lineHeight: 1.7, margin: 0 }}>{w.meaning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Color palette */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Color System</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { name: "Cosmos", hex: O.cosmos, use: "Primary background" },
                { name: "Nova", hex: O.nova, use: "Primary action, links" },
                { name: "Pulsar", hex: O.pulsar, use: "Success, growth, CTA" },
                { name: "Solar", hex: O.solar, use: "Premium, accent" },
                { name: "Comet", hex: O.comet, use: "Alerts, energy" },
              ].map((c, i) => (
                <div key={i} style={{ ...card, padding: 14, textAlign: "center" }}>
                  <div style={{ width: "100%", height: 48, borderRadius: 8, background: c.hex, marginBottom: 8, border: c.hex === O.cosmos ? `1px solid ${O.nova}30` : "none" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.name}</div>
                  <code style={{ fontSize: 10, color: O.stardust }}>{c.hex}</code>
                  <div style={{ fontSize: 9, color: "#4b5574", marginTop: 2 }}>{c.use}</div>
                </div>
              ))}
            </div>

            {/* Domains */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Content Domains</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {DOMAINS.map(d => (
                <div key={d.name} style={{ ...glow(d.color), padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{d.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 1: TECH STACK ═══ */}
        {activeTab === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>Technology Stack</h2>
            {Object.entries(TECH_STACK).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: O.pulsar, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, borderBottom: `1px solid ${O.pulsar}15`, paddingBottom: 6 }}>
                  {cat === "frontend" ? "⚡ Frontend" : cat === "backend" ? "🔧 Backend" : cat === "database" ? "🗄️ Database" : "☁️ Infrastructure"}
                </h3>
                <div style={{ display: "grid", gap: 6 }}>
                  {items.map((item, i) => (
                    <div key={i} onClick={() => setExpandedTech(expandedTech === `${cat}-${i}` ? null : `${cat}-${i}`)} style={{ ...card, padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <code style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{item.tech}</code>
                          <Badge color={O.stardust}>{item.role}</Badge>
                        </div>
                        <span style={{ fontSize: 10, color: "#4b5574" }}>{expandedTech === `${cat}-${i}` ? "▲" : "▼"}</span>
                      </div>
                      {expandedTech === `${cat}-${i}` && <p style={{ fontSize: 12, color: O.stardust, marginTop: 8, lineHeight: 1.6 }}>{item.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ TAB 2: ARCHITECTURE ═══ */}
        {activeTab === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>System Architecture</h2>
            <div style={{ ...card, padding: 20, overflowX: "auto" }}>
              <pre style={{ margin: 0, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8, color: O.stardust }}>{`
┌───────────────────────────────────────────────────────────────────────┐
│                    CDN (Cloudflare) — omnilearn.space                │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────┐
│                       NEXT.JS 15 (Frontend)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Dashboard │ │Learning  │ │Course    │ │Social    │ │Admin      │  │
│  │& Profile │ │Path View │ │Player    │ │Feed      │ │Panel      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Micro-    │ │Podcast   │ │Document  │ │Games &   │ │Path       │  │
│  │Learning  │ │Player    │ │Library   │ │Quizzes   │ │Builder    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ GraphQL + REST
┌──────────────────────────────▼────────────────────────────────────────┐
│                      API GATEWAY (NestJS)                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │
│  │Auth Guard  │ │Rate Limit  │ │RBAC Guard  │ │Learning Path       │ │
│  │(Keycloak)  │ │(Redis)     │ │(Policies)  │ │Orchestrator        │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘ │
└──┬─────────┬─────────┬─────────┬─────────┬──────────┬────────────────┘
   ▼         ▼         ▼         ▼         ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────────┐
│Course│ │User  │ │Content │ │Social│ │Analyti │ │Learning Path │
│Module│ │Module│ │Deliver │ │Module│ │Module  │ │Module        │
└──────┘ └──────┘ └────────┘ └──────┘ └────────┘ └──────────────┘
   │        │         │           │          │          │
   └────────┴─────────┴───────┬───┴──────────┴──────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  PostgreSQL 16  │  │     Redis 7      │  │  MinIO / R2     │
│ + pgvector      │  │                  │  │                 │
│ omnilearn.space │  │ • Sessions       │  │ • Videos (HLS)  │
│ • Users/Tenants │  │ • Cache          │  │ • Podcasts      │
│ • Courses       │  │ • Leaderboards   │  │ • Documents     │
│ • Learning Paths│  │ • Rate limits    │  │ • Certificates  │
│ • Social data   │  │ • Path progress  │  │ • Thumbnails    │
└─────────────────┘  └──────────────────┘  └─────────────────┘`}</pre>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: RBAC ═══ */}
        {activeTab === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>Role-Based Access Control</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {RBAC_ROLES.map((r, i) => (
                <div key={i} style={{ ...card, padding: "12px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 140, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.role}</span>
                  </div>
                  <span style={{ fontSize: 12, color: O.stardust, lineHeight: 1.6 }}>{r.permissions}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 4: LEARNING PATHS ═══ */}
        {activeTab === 4 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#fff" }}>Learning Paths</h2>
            <p style={{ fontSize: 13, color: O.stardust, marginBottom: 20 }}>Curated journeys mixing all content types — named, ordered sequences with prerequisites and completion certificates.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {CONTENT_TYPES.map(ct => (
                <div key={ct.type} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: `${ct.color}0c`, borderRadius: 5, border: `1px solid ${ct.color}20` }}>
                  <span style={{ fontSize: 12 }}>{ct.icon}</span>
                  <span style={{ fontSize: 10, color: ct.color, fontWeight: 600 }}>{ct.type}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20 }}>
              {SAMPLE_PATHS.map((p, i) => (
                <button key={p.id} onClick={() => setSelectedPath(i)} style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: selectedPath === i ? `${p.color}15` : O.nebula,
                  border: selectedPath === i ? `1px solid ${p.color}40` : `1px solid rgba(99,102,241,0.08)`,
                  color: selectedPath === i ? p.color : "#4b5574", whiteSpace: "nowrap", fontFamily: "inherit",
                }}>{p.icon} {p.name}</button>
              ))}
            </div>

            <div style={{ ...glow(currentPath.color), padding: 22, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 28 }}>{currentPath.icon}</span>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>{currentPath.name}</h3>
                  </div>
                  <p style={{ fontSize: 13, color: O.stardust, margin: 0 }}>{currentPath.description}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge color={currentPath.color}>{currentPath.domain}</Badge>
                  <Badge color={O.stardust}>{currentPath.difficulty}</Badge>
                  <Badge color={O.stardust}>{currentPath.duration}</Badge>
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#4b5574" }}>
                <span><strong style={{ color: O.white }}>{currentPath.enrolled}</strong> enrolled</span>
                <span><strong style={{ color: O.white }}>{currentPath.completion}%</strong> avg completion</span>
                <span><strong style={{ color: O.white }}>{currentPath.steps.length}</strong> steps</span>
              </div>
            </div>

            <div style={{ position: "relative", paddingLeft: 28 }}>
              <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${currentPath.color}60, ${currentPath.color}10)` }} />
              {currentPath.steps.map((step, i) => {
                const ct = CONTENT_TYPES.find(c => c.type === step.type);
                return (
                  <div key={i} style={{ position: "relative", marginBottom: 8 }}>
                    <div style={{
                      position: "absolute", left: -22, top: 12, width: 18, height: 18, borderRadius: "50%",
                      background: step.required ? currentPath.color : O.nebula,
                      border: step.required ? "none" : `2px solid ${currentPath.color}50`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: step.required ? "#fff" : currentPath.color,
                    }}>{step.order}</div>
                    <div style={{ ...card, padding: "10px 14px", marginLeft: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{ct?.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{step.title}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: ct?.color, fontWeight: 600 }}>{step.type}</span>
                            <span style={{ fontSize: 10, color: "#4b5574" }}>{step.duration}</span>
                          </div>
                        </div>
                      </div>
                      <Badge color={step.required ? currentPath.color : "#4b5574"}>{step.required ? "Required" : "Optional"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TAB 5: ADMIN PANEL ═══ */}
        {activeTab === 5 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>Admin — Learning Path Builder</h2>
              <div style={{ display: "flex", gap: 6 }}>
                {["list", "builder"].map(v => (
                  <button key={v} onClick={() => setAdminView(v)} style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: adminView === v ? O.nova : "rgba(255,255,255,0.04)",
                    border: adminView === v ? "none" : `1px solid rgba(99,102,241,0.1)`,
                    color: adminView === v ? "#fff" : "#4b5574", fontFamily: "inherit", textTransform: "capitalize",
                  }}>{v === "builder" ? "Path Builder" : "All Paths"}</button>
                ))}
              </div>
            </div>

            {adminView === "list" && (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <input placeholder="Search learning paths on omnilearn.space..." style={{
                    flex: 1, padding: "10px 14px", background: O.nebula, border: `1px solid rgba(99,102,241,0.1)`,
                    borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit",
                  }} />
                  <button onClick={() => setAdminView("builder")} style={{
                    padding: "10px 20px", borderRadius: 8, background: `linear-gradient(135deg, ${O.nova}, ${O.pulsar})`,
                    color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>+ New Path</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid rgba(99,102,241,0.1)` }}>
                      {["Path Name", "Domain", "Steps", "Enrolled", "Completion", "Status", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, color: "#4b5574", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_PATHS.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid rgba(99,102,241,0.05)` }}>
                        <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{p.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: "#4b5574" }}>{p.difficulty} · {p.duration}</div>
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}><Badge color={p.color}>{p.domain}</Badge></td>
                        <td style={{ padding: "12px", fontSize: 13, color: O.stardust }}>{p.steps.length}</td>
                        <td style={{ padding: "12px", fontSize: 13, color: O.stardust }}>{p.enrolled}</td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{ width: `${p.completion}%`, height: "100%", background: p.color, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: O.stardust }}>{p.completion}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}><Badge color={O.pulsar}>Live</Badge></td>
                        <td style={{ padding: "12px" }}>
                          <button style={{ padding: "4px 10px", borderRadius: 4, background: `${O.nova}15`, border: `1px solid ${O.nova}30`, color: O.novaLight, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminView === "builder" && (
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
                <div>
                  <div style={{ ...card, padding: 18, marginBottom: 14 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: O.pulsar, marginBottom: 12, marginTop: 0 }}>Path Configuration</h4>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, color: "#4b5574", fontWeight: 600, display: "block", marginBottom: 4 }}>PATH NAME</label>
                      <input value={pathName} onChange={e => setPathName(e.target.value)} style={{
                        width: "100%", padding: "8px 12px", background: O.cosmos, border: `1px solid rgba(99,102,241,0.1)`,
                        borderRadius: 6, color: "#fff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                      }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, color: "#4b5574", fontWeight: 600, display: "block", marginBottom: 4 }}>DOMAIN</label>
                      <select value={pathDomain} onChange={e => setPathDomain(e.target.value)} style={{
                        width: "100%", padding: "8px 12px", background: O.cosmos, border: `1px solid rgba(99,102,241,0.1)`,
                        borderRadius: 6, color: "#fff", fontSize: 13, fontFamily: "inherit",
                      }}>
                        {DOMAINS.map(d => <option key={d.name} value={d.name}>{d.icon} {d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ ...card, padding: 18 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: O.pulsar, marginBottom: 10, marginTop: 0 }}>Add Content Block</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {CONTENT_TYPES.map(ct => (
                        <button key={ct.type} onClick={() => addStep(ct.type)} style={{
                          padding: "10px 8px", borderRadius: 8, background: `${ct.color}08`, border: `1px solid ${ct.color}20`,
                          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit",
                        }}>
                          <span style={{ fontSize: 18 }}>{ct.icon}</span>
                          <span style={{ fontSize: 9, color: ct.color, fontWeight: 600 }}>{ct.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{pathName || "Untitled"} <span style={{ fontSize: 12, color: "#4b5574", fontWeight: 400 }}>— {builderSteps.length} steps</span></h4>
                    <button style={{
                      padding: "8px 20px", borderRadius: 8, background: `linear-gradient(135deg, ${O.nova}, ${O.pulsar})`,
                      color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}>Save Path</button>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {builderSteps.map((step, i) => {
                      const ct = CONTENT_TYPES.find(c => c.type === step.type);
                      return (
                        <div key={step.id} style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", minWidth: 24 }}>
                            <button onClick={() => moveStep(i, i - 1)} style={{ background: "none", border: "none", color: "#4b5574", cursor: "pointer", fontSize: 9, padding: 0 }}>▲</button>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#4b5574" }}>{i + 1}</span>
                            <button onClick={() => moveStep(i, i + 1)} style={{ background: "none", border: "none", color: "#4b5574", cursor: "pointer", fontSize: 9, padding: 0 }}>▼</button>
                          </div>
                          <span style={{ fontSize: 20 }}>{ct?.icon}</span>
                          <div style={{ flex: 1 }}>
                            <input value={step.title} onChange={e => { const v = e.target.value; setBuilderSteps(p => p.map(s => s.id === step.id ? { ...s, title: v } : s)); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, width: "100%", outline: "none", fontFamily: "inherit" }} />
                            <div style={{ fontSize: 10, color: ct?.color, fontWeight: 600, marginTop: 1 }}>{step.type}</div>
                          </div>
                          <button onClick={() => toggleRequired(step.id)} style={{
                            padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                            background: step.required ? `${O.pulsar}15` : "rgba(255,255,255,0.03)",
                            border: step.required ? `1px solid ${O.pulsar}30` : `1px solid rgba(255,255,255,0.06)`,
                            color: step.required ? O.pulsar : "#4b5574", fontFamily: "inherit",
                          }}>{step.required ? "Required" : "Optional"}</button>
                          <button onClick={() => removeStep(step.id)} style={{
                            width: 22, height: 22, borderRadius: 4, background: `${O.comet}10`, border: `1px solid ${O.comet}20`,
                            color: O.comet, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 6: FEATURES ═══ */}
        {activeTab === 6 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>Features</h2>
            {Object.entries(FEATURES).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: cat === "core" ? O.pulsar : cat === "social" ? O.novaLight : O.solar, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
                  {cat === "core" ? "🎯 Core Learning" : cat === "social" ? "💬 Social" : "🏢 Enterprise"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {items.map((item, i) => <div key={i} style={{ fontSize: 12, color: O.stardust, padding: "8px 12px", ...card }}>{item}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ TAB 7: DATABASE ═══ */}
        {activeTab === 7 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>Database Schema</h2>
            <div style={{ ...card, padding: 20, overflowX: "auto" }}>
              <pre style={{ margin: 0, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8, color: O.stardust }}>{`
-- omnilearn.space core schema (PostgreSQL 16 + pgvector)

┌─────────────────────┐         ┌──────────────────────────┐
│   learning_paths    │         │   learning_path_steps    │
├─────────────────────┤         ├──────────────────────────┤
│ id           (uuid) │◄────────│ path_id          (fk)    │
│ tenant_id    (fk)   │         │ id               (uuid)  │
│ name         (text) │         │ content_item_id  (fk)    │───┐
│ slug         (text) │         │ step_order       (int)   │   │
│ domain       (enum) │         │ is_required      (bool)  │   │
│ difficulty   (text) │         │ unlock_after_id  (self)  │   │
│ description  (text) │         │ time_gate_hours  (int?)  │   │
│ is_published (bool) │         └──────────────────────────┘   │
│ settings     (jsonb)│                                        │
└─────────────────────┘         ┌──────────────────────────┐   │
                                │   content_items          │◄──┘
┌─────────────────────┐         ├──────────────────────────┤
│ path_enrollments    │         │ id               (uuid)  │
├─────────────────────┤         │ type             (enum)  │
│ user_id      (fk)   │         │ title            (text)  │
│ path_id      (fk)   │         │ media_id         (fk)    │
│ status       (enum) │         │ duration_minutes (int)   │
│ progress_pct (int)  │         │ metadata         (jsonb) │
│ deadline     (ts?)  │         └──────────────────────────┘
│ completed_at (ts?)  │
└─────────────────────┘         ┌──────────────────────────┐
                                │   certificate_templates  │
┌─────────────────────┐         ├──────────────────────────┤
│ path_step_progress  │         │ domain           (enum)  │
├─────────────────────┤         │ template_name    (text)  │
│ enrollment_id(fk)   │         │ theme_config     (jsonb) │
│ step_id      (fk)   │         │ elements_config  (jsonb) │
│ status       (enum) │         │ signatories      (jsonb) │
│ time_spent   (int)  │         └──────────────────────────┘
│ score        (int?) │
└─────────────────────┘         ┌──────────────────────────┐
                                │   issued_certificates    │
                                ├──────────────────────────┤
                                │ template_id      (fk)    │
                                │ enrollment_id    (fk)    │
                                │ verify_code      (text)  │
                                │ pdf_url          (text)  │
                                │ grade            (enum)  │
                                └──────────────────────────┘`}</pre>
            </div>
          </div>
        )}

        {/* ═══ TAB 8: ROADMAP ═══ */}
        {activeTab === 8 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#fff" }}>Development Roadmap</h2>
            {[
              { phase: "Phase 1 — Foundation", weeks: "Weeks 1–4", color: O.nova, items: ["Project scaffolding (Next.js + NestJS + PostgreSQL)", "omnilearn.space domain + Cloudflare setup", "Keycloak SSO + multi-tenant RBAC", "Design system + UI component library", "CI/CD pipeline"] },
              { phase: "Phase 2 — Core Learning", weeks: "Weeks 5–8", color: O.pulsar, items: ["Course builder (SCORM/xAPI)", "Video/Podcast player (HLS)", "Learning Path data model + CRUD", "Progress tracking + certificates", "Domain-themed certificate templates"] },
              { phase: "Phase 3 — Engagement", weeks: "Weeks 9–12", color: O.solar, items: ["Learning Path Builder (admin)", "Path enrollment + step progress", "Gamification (points, badges, streaks)", "Implementation guide wizard", "Interactive quizzes + games"] },
              { phase: "Phase 4 — Social & Enterprise", weeks: "Weeks 13–18", color: O.novaLight, items: ["Discussion forums + moderation", "Course reviews + ratings", "Company admin panel + branding", "Advanced analytics dashboard", "Bulk provisioning (SCIM)"] },
              { phase: "Phase 5 — Intelligence", weeks: "Weeks 19–24", color: O.comet, items: ["AI content recommendations (pgvector)", "Smart path suggestions", "Semantic search", "Predictive analytics", "Mobile app (React Native)"] },
            ].map((phase, i) => (
              <div key={i} style={{ marginBottom: 18, display: "flex", gap: 14 }}>
                <div style={{ minWidth: 3, background: phase.color, borderRadius: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: phase.color, margin: 0 }}>{phase.phase}</h3>
                    <span style={{ fontSize: 11, color: "#4b5574" }}>{phase.weeks}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {phase.items.map((item, j) => <div key={j} style={{ fontSize: 12, color: O.stardust, padding: "7px 12px", ...card }}>{item}</div>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `1px solid rgba(99,102,241,0.08)`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OmnilearnLogo size="sm" />
        <span style={{ fontSize: 10, color: "#2d3555" }}>omnilearn.space — Architecture Blueprint v2.0 — Confidential — {BRAND.parent}</span>
      </div>
    </div>
  );
}
