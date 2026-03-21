import { Injectable } from '@nestjs/common';
import { ResolvedEmailBranding } from './branding-types';

export interface RenderedEmailParts {
  subject: string;
  htmlBody: string;
  textBody: string | null;
}

/**
 * Applies `{{key}}` substitution and injects common branding keys for templates.
 * MJML precompilation can be added later (build step or runtime) without changing callers.
 */
@Injectable()
export class TemplateEngineService {
  render(
    subjectTemplate: string,
    htmlTemplate: string,
    textTemplate: string | null,
    variables: Record<string, string>,
    branding: ResolvedEmailBranding,
  ): RenderedEmailParts {
    const merged: Record<string, string> = {
      ...this.brandingToVariables(branding),
      ...variables,
    };

    return {
      subject: this.replaceAll(subjectTemplate, merged),
      htmlBody: this.replaceAll(htmlTemplate, merged),
      textBody: textTemplate ? this.replaceAll(textTemplate, merged) : null,
    };
  }

  private brandingToVariables(b: ResolvedEmailBranding): Record<string, string> {
    return {
      platform_name: b.platformName,
      logo_url: b.logoUrl || '',
      primary_color: b.primaryColor,
      secondary_color: b.secondaryColor,
      accent_color: b.accentColor,
      text_color: b.textColor,
      background_color: b.backgroundColor,
      surface_color: b.surfaceColor,
      border_radius: b.borderRadius,
      font_family: b.rtl ? b.fontFamilyAr : b.fontFamily,
      sender_name: b.senderName,
      sender_email: b.senderEmail,
      base_url: b.baseUrl,
      footer_text: b.footerText || '',
      dir: b.rtl ? 'rtl' : 'ltr',
    };
  }

  private replaceAll(template: string, vars: Record<string, string>): string {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `{{${key}}}`;
      const re = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      out = out.replace(re, value);
    }
    return out;
  }
}
