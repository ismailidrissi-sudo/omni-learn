export function completionCertificateHtml(params: {
  name: string;
  contentTitle: string;
  contentLabel: string;
  verifyUrl: string;
  walletUrl: string;
  downloadUrl?: string;
}): string {
  const downloadSection = params.downloadUrl
    ? `<p style="margin-top: 16px;">
        <a href="${params.downloadUrl}" style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">Download PDF Certificate</a>
        <span style="display: block; margin-top: 4px; color: #999; font-size: 12px;">Link valid for 30 days</span>
      </p>`
    : '';

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">Congratulations, ${escapeHtml(params.name)}!</h2>
      <p>You completed <strong>${escapeHtml(params.contentTitle)}</strong>.</p>
      <p>Your ${escapeHtml(params.contentLabel)} certificate is ready.</p>
      <p>
        <a href="${params.walletUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View in your wallet</a>
      </p>
      ${downloadSection}
      <p style="color: #666; font-size: 14px;">
        Shareable verification link (no login required):<br/>
        <a href="${params.verifyUrl}">${params.verifyUrl}</a>
      </p>
    </div>
  `;
}

export function completionCertificateSubject(contentTitle: string): string {
  return `You earned a certificate: ${contentTitle}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
