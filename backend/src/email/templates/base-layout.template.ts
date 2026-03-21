import { ResolvedEmailBranding } from './branding-types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function wrapInLayout(
  bodyHtml: string,
  branding: ResolvedEmailBranding,
  options?: { unsubscribeUrl?: string; preferencesUrl?: string },
): string {
  const dir = branding.rtl ? 'rtl' : 'ltr';
  const font = branding.rtl ? branding.fontFamilyAr : branding.fontFamily;
  const align = branding.rtl ? 'right' : 'left';

  const footerLinksHtml = branding.footerLinks
    .map(
      (l) =>
        `<a href="${esc(l.url)}" style="color:${branding.primaryColor};text-decoration:underline;">${esc(l.label)}</a>`,
    )
    .join(' &middot; ');

  const unsubHtml = options?.unsubscribeUrl
    ? `<a href="${esc(options.unsubscribeUrl)}" style="color:#999;text-decoration:underline;">Unsubscribe</a>`
    : '';

  const prefsHtml = options?.preferencesUrl
    ? `<a href="${esc(options.preferencesUrl)}" style="color:#999;text-decoration:underline;">Email preferences</a>`
    : '';

  const footerActions = [unsubHtml, prefsHtml].filter(Boolean).join(' &middot; ');

  return `<!DOCTYPE html>
<html lang="${branding.rtl ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(branding.platformName)}</title>
  <style>
    body { margin:0; padding:0; background:${branding.backgroundColor}; }
    ${branding.customCss || ''}
  </style>
</head>
<body style="margin:0;padding:0;background:${branding.backgroundColor};font-family:${font};direction:${dir};color:${branding.textColor};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${branding.backgroundColor};">
    <tr><td align="center" style="padding:24px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${branding.surfaceColor};border-radius:${branding.borderRadius};overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:24px 32px;background:${branding.secondaryColor};text-align:${align};">
            ${
              branding.logoUrl
                ? `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.platformName)}" height="36" style="height:36px;display:inline-block;" />`
                : `<span style="font-size:20px;font-weight:700;color:#fff;font-family:${font};">${esc(branding.platformName)}</span>`
            }
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;text-align:${align};font-size:15px;line-height:1.6;color:${branding.textColor};">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid ${branding.backgroundColor};text-align:center;font-size:12px;color:#999;">
            ${branding.footerText ? `<p style="margin:0 0 8px;">${esc(branding.footerText)}</p>` : ''}
            ${footerLinksHtml ? `<p style="margin:0 0 8px;">${footerLinksHtml}</p>` : ''}
            ${footerActions ? `<p style="margin:0 0 8px;">${footerActions}</p>` : ''}
            <p style="margin:0;color:#bbb;">${esc(branding.platformName)}</p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

export function ctaButton(
  text: string,
  url: string,
  branding: ResolvedEmailBranding,
): string {
  const btnRadius = (branding.buttonStyle?.borderRadius as string) || branding.borderRadius;
  const btnPadding = (branding.buttonStyle?.padding as string) || '12px 24px';
  const btnWeight = (branding.buttonStyle?.fontWeight as string) || '600';

  return `<a href="${esc(url)}" style="display:inline-block;background:${branding.primaryColor};color:#fff;padding:${btnPadding};border-radius:${btnRadius};text-decoration:none;font-weight:${btnWeight};font-size:15px;">${esc(text)}</a>`;
}
