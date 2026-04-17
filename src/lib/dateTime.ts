const KUALA_LUMPUR_TIMEZONE = "Asia/Kuala_Lumpur";

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeKualaLumpur(
  value: string | Date | null | undefined,
  locale = "en-MY"
): string {
  if (!value) return "-";
  const date = toDate(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(locale, {
    timeZone: KUALA_LUMPUR_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateKualaLumpur(
  value: string | Date | null | undefined,
  locale = "en-MY",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" }
): string {
  if (!value) return "-";
  const date = toDate(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(locale, {
    timeZone: KUALA_LUMPUR_TIMEZONE,
    ...options,
  }).format(date);
}
