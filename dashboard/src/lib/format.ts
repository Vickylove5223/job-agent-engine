export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) return "in the future";
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const y = Math.round(mo / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatSalary(s?: { min?: number; max?: number; currency: string }): string {
  if (!s || (!s.min && !s.max)) return "—";
  const f = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const cur = s.currency === "USD" ? "$" : s.currency === "NGN" ? "₦" : s.currency === "GBP" ? "£" : s.currency === "EUR" ? "€" : s.currency + " ";
  if (s.min && s.max) return `${cur}${f(s.min)}–${f(s.max)}`;
  return `${cur}${f((s.min ?? s.max)!)}`;
}

export function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Worker is online if its heartbeat is less than 15 minutes old (cloud runs every 10 min). */
export function isOnline(heartbeatAt?: string): boolean {
  return !!heartbeatAt && Date.now() - new Date(heartbeatAt).getTime() < 15 * 60_000;
}
