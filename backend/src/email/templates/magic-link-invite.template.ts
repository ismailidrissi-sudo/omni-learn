export function magicLinkInviteSubject(academyName: string): string {
  return `You're invited to join ${academyName}`;
}

export function magicLinkInviteHtml(
  academyName: string,
  magicUrl: string,
  expiresInHours: number,
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to ${academyName}!</h2>
      <p>Your organization administrator has invited you to join <strong>${academyName}</strong> on OmniLearn.</p>
      <p>Click the button below to set up your account. No password is needed &mdash; this secure link will sign you in automatically.</p>
      <p style="margin: 24px 0;">
        <a href="${magicUrl}" style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
          Join ${academyName}
        </a>
      </p>
      <p>Or copy this link: <br/><span style="word-break: break-all;">${magicUrl}</span></p>
      <p style="color: #666;">This link expires in ${expiresInHours} hours. After that, ask your administrator to send a new invitation.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #666; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  `;
}
