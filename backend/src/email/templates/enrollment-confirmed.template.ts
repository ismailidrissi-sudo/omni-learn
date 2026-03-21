export function enrollmentConfirmedHtml(
  name: string,
  contentTitle: string,
  contentType: string,
  startUrl: string,
  assignedByLabel?: string,
): string {
  const intro = assignedByLabel
    ? `<p><strong>${escapeHtml(assignedByLabel)}</strong> enrolled you in this ${contentType}.</p>`
    : `<p>You're enrolled in this ${contentType}.</p>`;
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">${escapeHtml(contentTitle)}</h2>
      <p>Hi ${escapeHtml(name)},</p>
      ${intro}
      <p><a href="${startUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Start learning</a></p>
    </div>
  `;
}

export function enrollmentConfirmedSubject(contentTitle: string): string {
  return `You're enrolled: ${contentTitle}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
