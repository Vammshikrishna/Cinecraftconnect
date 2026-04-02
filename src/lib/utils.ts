import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures a URL has a protocol (http/https).
 * If missing, prepends https:// and trims whitespace.
 */
export function formatURL(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed === '') return '';
  if (!/^(https?:\/\/)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

