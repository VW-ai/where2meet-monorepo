import type { Locale } from '@/shared/lib/i18n';

export function slowestRoute<T extends { durationSeconds: number }>(routes: readonly T[]): T | null {
  return routes.reduce<T | null>(
    (slowest, route) =>
      !slowest || route.durationSeconds > slowest.durationSeconds ? route : slowest,
    null
  );
}

/** en `25 min`, `1 hr 5 min`; zh `25 分钟`, `1 小时 5 分钟`. Never rounds a real trip down to zero. */
export function formatTripTime(seconds: number, locale: Locale): string {
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const [hr, min] = locale === 'zh' ? ['小时', '分钟'] : ['hr', 'min'];
  if (hours === 0) return `${minutes} ${min}`;
  return minutes === 0 ? `${hours} ${hr}` : `${hours} ${hr} ${minutes} ${min}`;
}
