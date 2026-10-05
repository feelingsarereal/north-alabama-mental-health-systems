/** Download helpers (ported from ptsd-inflammation-critique's figures/download.ts, the parts this app uses). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export const downloadText = (text: string, filename: string, type = 'text/plain;charset=utf-8') => downloadBlob(new Blob([text], { type }), filename);

/** RFC 4180 CSV: quote every field that needs it. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const q = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
