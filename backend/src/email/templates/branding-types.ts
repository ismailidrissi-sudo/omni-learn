/**
 * Resolved branding passed into templates and stored on email_logs.brandingSnapshot
 */
export interface ResolvedEmailBranding {
  platformName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  surfaceColor: string;
  borderRadius: string;
  fontFamily: string;
  fontFamilyAr: string;
  buttonStyle: Record<string, unknown>;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  footerText: string | null;
  footerLinks: Array<{ label: string; url: string }>;
  customCss: string | null;
  baseUrl: string;
  rtl: boolean;
}
