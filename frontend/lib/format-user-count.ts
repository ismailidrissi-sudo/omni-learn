/** Same rounding/display rules as the homepage TrustBar user count. */
export function formatUserCount(count: number): string {
  if (count >= 1_000_000) {
    const millions = Math.floor(count / 1_000_000);
    return `${millions.toLocaleString("en-US")},000,000+`;
  }
  if (count >= 1_000) {
    const thousands = Math.floor(count / 1_000) * 1_000;
    return `${thousands.toLocaleString("en-US")}+`;
  }
  return `${count}+`;
}
