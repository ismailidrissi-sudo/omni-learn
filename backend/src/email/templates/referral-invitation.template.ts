export function referralInvitationHtml(
  recipientName: string,
  senderName: string,
  referralUrl: string,
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${recipientName},</h2>
      <p><strong>${senderName}</strong> thinks you'd love OmniLearn — the platform where every skill lives in one space.</p>
      <p>Join now and start your learning journey:</p>
      <p><a href="${referralUrl}" style="background: #6B4E9A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Join OmniLearn</a></p>
      <p>Or copy this link: ${referralUrl}</p>
      <p style="color: #666; font-size: 14px;">When you sign up through this link, both you and ${senderName} may receive special benefits!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #666; font-size: 12px;">OmniLearn — Every Skill. One Space. | Afflatus Consulting Group</p>
    </div>
  `;
}

export function referralInvitationSubject(senderName: string): string {
  return `${senderName} invited you to OmniLearn`;
}
