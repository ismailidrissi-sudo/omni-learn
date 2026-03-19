export function testEmailHtml(): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #6366f1;">OmniLearn Email Test</h2>
      <p>This is a test email from your OmniLearn.space platform.</p>
      <p>If you received this, your Resend email configuration is working correctly.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 13px;">
        Sent via Resend API &bull; OmniLearn.space Admin Panel
      </p>
    </div>
  `;
}

export function testEmailSubject(): string {
  return 'OmniLearn — Test Email';
}
