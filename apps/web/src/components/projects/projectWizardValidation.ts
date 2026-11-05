/** Pure validation for the project creation wizard. Each function returns an error message, or null when valid. */

export const PROJECT_NAME_MAX = 100;
export const PROJECT_DESCRIPTION_MAX = 2000;
export const PROJECT_LOCATION_MAX = 120;

export function validateBasicInfoStep(d: { name: string; description: string; location?: string }): string | null {
  const missing: string[] = [];
  if (!d.name.trim()) missing.push('Project name');
  if (!d.description.trim()) missing.push('Description');
  if (missing.length) return `Please fill in the required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`;
  if (d.name.trim().length > PROJECT_NAME_MAX) return `Project name must be ${PROJECT_NAME_MAX} characters or fewer.`;
  if (d.description.trim().length > PROJECT_DESCRIPTION_MAX) return `Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer.`;
  if ((d.location || '').trim().length > PROJECT_LOCATION_MAX) return `Location must be ${PROJECT_LOCATION_MAX} characters or fewer.`;
  return null;
}

export function validateGenreStep(d: { genre: string[] }): string | null {
  return d.genre.length > 0 ? null : 'Please fill in the required field: pick at least one genre.';
}

export function validateBudgetTimelineStep(d: {
  budget_min: string; budget_max: string; start_date: string; end_date: string;
}): string | null {
  const min = d.budget_min.trim() === '' ? null : Number(d.budget_min);
  const max = d.budget_max.trim() === '' ? null : Number(d.budget_max);
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) return 'Budget must be a number.';
  if ((min !== null && min < 0) || (max !== null && max < 0)) return 'Budget cannot be negative.';
  if (min !== null && max !== null && max < min) return 'Maximum budget must be greater than or equal to the minimum budget.';
  if (d.start_date && d.end_date && d.end_date < d.start_date) return 'End date must be on or after the start date.';
  return null;
}
