export function passwordResetRequestHtml(resetUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Reset your password</h2>
      <p>We received a request to reset your OmniLearn password.</p>
      <p><a href="${resetUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset password</a></p>
      <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

export function passwordResetRequestSubject(): string {
  return 'Reset your OmniLearn password';
}
