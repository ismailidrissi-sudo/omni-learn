export function accountActivatedHtml(name: string, loginUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Welcome</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your email is verified and your OmniLearn account is ready.</p>
      <p><a href="${loginUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Log in</a></p>
      <p style="color: #666; font-size: 14px;">If you did not create this account, contact support.</p>
    </div>
  `;
}

export function accountActivatedSubject(): string {
  return 'Your OmniLearn account is ready';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
