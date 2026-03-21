export interface ContentSuggestionItem {
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  categoryBadge?: string;
  duration?: string;
}

export interface ContentSuggestionParams {
  name: string;
  heading: string;
  intro: string;
  items: ContentSuggestionItem[];
  unsubscribeUrl?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

function renderCard(item: ContentSuggestionItem): string {
  const thumbnail = item.thumbnailUrl
    ? `<td width="120" style="padding-right:16px;vertical-align:top;">
        <img src="${esc(item.thumbnailUrl)}" alt="" width="120" height="68"
             style="display:block;border-radius:6px;object-fit:cover;width:120px;height:68px;" />
      </td>`
    : '';

  const badge = item.categoryBadge
    ? `<span style="display:inline-block;background:#EEF2FF;color:#4338CA;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-bottom:6px;">${esc(item.categoryBadge)}</span>`
    : '';

  const duration = item.duration
    ? `<span style="display:inline-block;color:#6B7280;font-size:12px;margin-left:${item.categoryBadge ? '8px' : '0'};">${esc(item.duration)}</span>`
    : '';

  const meta = badge || duration ? `<div style="margin-bottom:6px;">${badge}${duration}</div>` : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-bottom:20px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              ${thumbnail}
              <td style="vertical-align:top;">
                ${meta}
                <div style="font-size:15px;font-weight:600;color:#1E1B4B;margin-bottom:4px;">
                  ${esc(item.title)}
                </div>
                <div style="font-size:13px;color:#4B5563;line-height:1.4;margin-bottom:10px;">
                  ${esc(truncate(item.description, 120))}
                </div>
                <a href="${esc(item.url)}"
                   style="display:inline-block;background:#6366F1;color:#ffffff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
                  Start Learning
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function contentSuggestionHtml(params: ContentSuggestionParams): string {
  const cards = params.items.map(renderCard).join('');

  const unsubscribe = params.unsubscribeUrl
    ? `<p style="margin-top:32px;text-align:center;font-size:12px;color:#9CA3AF;">
        <a href="${esc(params.unsubscribeUrl)}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe from suggestions</a>
      </p>`
    : '';

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1E1B4B;font-size:22px;margin-bottom:8px;">${esc(params.heading)}</h2>
      <p style="color:#4B5563;font-size:15px;line-height:1.5;margin-bottom:24px;">
        Hi ${esc(params.name)}, ${esc(params.intro)}
      </p>
      ${cards}
      ${unsubscribe}
    </div>
  `;
}

const SUBJECT_MAP: Record<string, (platformName: string) => string> = {
  post_signup: (p) => `Get started on ${p} \u2014 here are our top picks`,
  trending: (p) => `Trending on ${p} this week`,
  curated: (p) => `Curated picks just for you on ${p}`,
  reengagement: (p) => `We miss you on ${p} \u2014 here\u2019s what\u2019s new`,
};

export function contentSuggestionSubject(
  strategyLabel: string,
  platformName: string,
): string {
  const fn = SUBJECT_MAP[strategyLabel];
  return fn ? fn(platformName) : `New suggestions on ${platformName}`;
}
