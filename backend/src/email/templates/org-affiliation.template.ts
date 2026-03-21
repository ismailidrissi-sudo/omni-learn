export function accountApprovedHtml(name: string, loginUrl: string, tenantName: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">You're approved</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your access to <strong>${escapeHtml(tenantName)}</strong> on OmniLearn has been approved.</p>
      <p><a href="${loginUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Log in</a></p>
    </div>
  `;
}

export function accountApprovedSubject(tenantName: string): string {
  return `You're approved to join ${tenantName}`;
}

export function accountRejectedHtml(name: string, reason?: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Application update</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your organization affiliation request on OmniLearn was not approved.</p>
      ${reason ? `<p style="color: #666;">${escapeHtml(reason)}</p>` : ''}
    </div>
  `;
}

export function accountRejectedSubject(): string {
  return 'Update on your OmniLearn organization request';
}

export function adminNewSignupReviewHtml(
  adminName: string,
  learnerName: string,
  learnerEmail: string,
  reviewUrl: string,
): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">New signup to review</h2>
      <p>Hi ${escapeHtml(adminName)},</p>
      <p><strong>${escapeHtml(learnerName)}</strong> (${escapeHtml(learnerEmail)}) verified their email and is waiting for organization approval.</p>
      <p><a href="${reviewUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Review pending users</a></p>
    </div>
  `;
}

export function adminNewSignupReviewSubject(learnerName: string): string {
  return `New signup pending review: ${learnerName}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
