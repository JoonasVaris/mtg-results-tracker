/** "2026-10-19" -> "19/10/2026" (matches how players read mtgtop8 dates). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '?';
}
