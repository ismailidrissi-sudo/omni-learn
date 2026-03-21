export function enrollmentManagerNotificationHtml(
  userName: string,
  contentTitle: string,
  contentType: string,
): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Enrollment update</h2>
      <p>Hi,</p>
      <p><strong>${escapeHtml(userName)}</strong> has been enrolled in <strong>${escapeHtml(contentTitle)}</strong> (${escapeHtml(contentType)}).</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #666; font-size: 12px;">OmniLearn — Afflatus Consulting Group</p>
    </div>
  `;
}

export function enrollmentManagerNotificationSubject(userName: string, contentTitle: string): string {
  return `${userName} enrolled: ${contentTitle}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
