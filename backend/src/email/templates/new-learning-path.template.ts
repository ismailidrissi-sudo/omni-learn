export function newLearningPathPublishedHtml(params: {
  name: string;
  pathName: string;
  domainName: string;
  exploreUrl: string;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E1B4B;">New learning path</h2>
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>A new path <strong>${escapeHtml(params.pathName)}</strong> is now available
        ${params.domainName ? ` in <strong>${escapeHtml(params.domainName)}</strong>` : ''}.</p>
      <p><a href="${params.exploreUrl}" style="background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Explore path</a></p>
    </div>
  `;
}

export function newLearningPathPublishedSubject(pathName: string): string {
  return `New on OmniLearn: ${pathName}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
