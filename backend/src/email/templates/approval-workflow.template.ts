function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function planApprovalPendingAdminSubject(): string {
  return 'OmniLearn — Paid plan signup pending approval';
}

export function planApprovalPendingAdminHtml(
  userName: string,
  userEmail: string,
  plan: string,
  adminApprovalsUrl: string,
): string {
  return `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e1b4b;">
  <p>A new user selected a paid plan and is awaiting approval.</p>
  <ul>
    <li><strong>Name:</strong> ${esc(userName)}</li>
    <li><strong>Email:</strong> ${esc(userEmail)}</li>
    <li><strong>Plan:</strong> ${esc(plan)}</li>
  </ul>
  <p><a href="${esc(adminApprovalsUrl)}">Open approvals queue</a></p>
</body></html>`;
}

export function planApprovedUserSubject(): string {
  return 'Your OmniLearn plan is approved';
}

export function planApprovedUserHtml(name: string, signInUrl: string): string {
  return `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e1b4b;">
  <p>Hi ${esc(name)},</p>
  <p>Your paid plan has been approved. You can sign in and access full learning features.</p>
  <p><a href="${esc(signInUrl)}">Sign in</a></p>
</body></html>`;
}

export function planRejectedUserSubject(): string {
  return 'OmniLearn plan request update';
}

export function planRejectedUserHtml(name: string, reason: string | undefined, signInUrl: string): string {
  const r = reason?.trim() ? `<p><strong>Note:</strong> ${esc(reason)}</p>` : '';
  return `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e1b4b;">
  <p>Hi ${esc(name)},</p>
  <p>Your paid plan request was not approved. You remain on the free Explorer tier.</p>
  ${r}
  <p><a href="${esc(signInUrl)}">Sign in</a></p>
</body></html>`;
}
