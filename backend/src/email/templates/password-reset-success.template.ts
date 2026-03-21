export function passwordResetSuccessHtml(name: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Password changed</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your OmniLearn password was changed successfully.</p>
      <p style="color: #666; font-size: 14px;">If you did not make this change, contact support immediately.</p>
    </div>
  `;
}

export function passwordResetSuccessSubject(): string {
  return 'Your OmniLearn password was changed';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
