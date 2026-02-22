export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  // Clamp future timestamps
  const ms = Math.max(0, diffMs);
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60)  return 'right now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60)  return `${minutes}m ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24)    return `${hours}h ago`;
  const days = Math.floor(ms / 86_400_000);
  return `${days}d ago`;
}
