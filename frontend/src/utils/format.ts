/**
 * Formatting helpers aligned with CHECKPOINT V2 honest data rules.
 */

export function formatReleaseYear(releaseDate: string | null | undefined): string {
  if (!releaseDate) return 'TBA';
  const match = /^(\d{4})/.exec(releaseDate);
  if (match?.[1]) return match[1];
  const parsed = new Date(releaseDate);
  if (!Number.isNaN(parsed.getFullYear())) {
    return String(parsed.getFullYear());
  }
  return 'TBA';
}

export function formatShortDate(dateValue: string | null | undefined): string {
  if (!dateValue) return 'Not set';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatIgdbRating(rating: number | null | undefined): string | null {
  if (rating === null || rating === undefined || Number.isNaN(rating) || rating <= 0) {
    return null;
  }
  return `${Math.round(rating)}`;
}

export function formatPersonalRating(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || Number.isNaN(rating)) {
    return 'Unrated';
  }
  return `${rating.toFixed(1)} / 10`;
}

export function formatHoursLogged(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours) || hours <= 0) {
    return 'No sessions logged';
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

export function splitCustomTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) return [];
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function joinCustomTags(tags: string[]): string {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).join(', ');
}
