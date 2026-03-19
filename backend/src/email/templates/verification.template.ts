export function verificationEmailHtml(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to OmniLearn, ${name}!</h2>
      <p>Please confirm your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Confirm Email</a></p>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #666; font-size: 12px;">OmniLearn — Afflatus Consulting Group</p>
    </div>
  `;
}

export function verificationEmailSubject(): string {
  return 'Confirm your OmniLearn account';
}
