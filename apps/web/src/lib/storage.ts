/**
 * @file src/lib/storage.ts
 *
 * Single source of truth for all Supabase Storage bucket names and
 * path helpers. Import from here instead of hardcoding strings in components.
 *
 * Why this matters:
 *  - Bucket renames → change in one place
 *  - Path construction is consistent and sanitised everywhere
 *  - URL → storage-path extraction logic is shared, not duplicated
 */

import { supabase } from '@/integrations/supabase/client';

// ── Bucket registry ──────────────────────────────────────────────────────────

/**
 * All Supabase Storage bucket identifiers used by this application.
 * Never hardcode these strings in components — always import from here.
 */
export const STORAGE_BUCKETS = {
  /** General project files (documents, images, videos) */
  PROJECT_FILES: 'project-files',
  /** Legal document PDFs and contracts */
  LEGAL_DOCUMENTS: 'legal-documents',
  /** User avatar and cover images */
  AVATARS: 'avatars',
  /** Portfolio media (images, videos, reels) */
  PORTFOLIO_MEDIA: 'portfolio-media',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// ── Folder prefixes within each bucket ──────────────────────────────────────

/**
 * Sub-folder prefixes inside the PROJECT_FILES bucket.
 * Use buildProjectFilePath() to compose the full object path.
 */
export const PROJECT_FILE_FOLDERS = {
  /** General files uploaded to the Files tab */
  FILES: 'files',
  /** PDF call sheets uploaded in the Call Sheets tab */
  CALL_SHEETS: 'call-sheets',
  /** Legal documents linked from the Legal Docs tab */
  LEGAL: 'legal',
} as const;

// ── Path builders ────────────────────────────────────────────────────────────

/**
 * Sanitises a filename by:
 *  - Replacing whitespace with underscores
 *  - Stripping path-traversal sequences (`../`, `./`)
 *  - Collapsing double slashes
 */
export function sanitiseFileName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/\.\.?\//g, '')
    .replace(/\/+/g, '/');
}

/**
 * Builds a unique, namespaced object path for project files.
 *
 * Pattern: `<folder>/<projectId>/<timestamp>-<sanitisedName>`
 *
 * @example
 * buildProjectFilePath('call-sheets', 'proj-123', 'Shoot Day 1.pdf')
 * // → 'call-sheets/proj-123/1716800000000-Shoot_Day_1.pdf'
 */
export function buildProjectFilePath(
  folder: string,
  projectId: string,
  fileName: string
): string {
  const safe = sanitiseFileName(fileName);
  return `${folder}/${projectId}/${Date.now()}-${safe}`;
}

/**
 * Builds a unique object path for user-scoped files.
 *
 * Pattern: `<userId>/<timestamp>-<sanitisedName>`
 */
export function buildUserFilePath(userId: string, fileName: string): string {
  const safe = sanitiseFileName(fileName);
  return `${userId}/${Date.now()}-${safe}`;
}

// ── URL → object path extraction ─────────────────────────────────────────────

/**
 * Extracts the Supabase Storage **object path** (the part after the bucket
 * name) from a public URL or a signed URL.
 *
 * Handles all URL shapes produced by `getPublicUrl` and `createSignedUrl`:
 *   - `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>`
 *   - `https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=…`
 *   - Legacy short form: `<bucket>/<path>` (no host)
 *
 * Returns `null` if the path cannot be determined.
 */
export function extractStoragePath(
  url: string,
  bucket: StorageBucket
): string | null {
  if (!url) return null;

  // Short-circuit for non-HTTP values already stored as paths
  if (!url.startsWith('http')) {
    return decodeURIComponent(url.split('?')[0]) || null;
  }

  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split('/');

    // Standard Supabase storage URL:
    // /storage/v1/object/public/<bucket>/<...path>
    // /storage/v1/object/sign/<bucket>/<...path>
    const objectIdx = segments.indexOf('object');
    if (objectIdx !== -1 && segments.length > objectIdx + 2) {
      // segments[objectIdx+1] = 'public' | 'sign'
      // segments[objectIdx+2] = bucket name
      const bucketIdx = objectIdx + 2;
      if (segments[bucketIdx] === bucket) {
        const path = segments.slice(bucketIdx + 1).join('/').split('?')[0];
        return decodeURIComponent(path) || null;
      }
    }

    // Fallback: find bucket name anywhere in the path
    const bucketIdx = segments.indexOf(bucket);
    if (bucketIdx !== -1) {
      const path = segments.slice(bucketIdx + 1).join('/').split('?')[0];
      return decodeURIComponent(path) || null;
    }
  } catch {
    // URL parse failed — try naive split
    const marker = `${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]) || null;
    }
  }

  return null;
}

// ── High-level helpers ───────────────────────────────────────────────────────

/**
 * Generates a short-lived (60 s) signed URL for a file, given its public URL.
 * Resolves to `null` on failure rather than throwing.
 */
export async function createSignedDownloadUrl(
  publicUrl: string,
  bucket: StorageBucket,
  expiresInSeconds = 60
): Promise<string | null> {
  const path = extractStoragePath(publicUrl, bucket);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Triggers a browser file download using a blob URL.
 * Cleans up the object URL after the click.
 */
export async function downloadFile(
  signedUrl: string,
  fileName: string
): Promise<void> {
  const response = await fetch(signedUrl);
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Convenience: creates a signed URL then immediately triggers a download.
 * Returns `true` on success, `false` on failure.
 */
export async function signAndDownload(
  publicUrl: string,
  bucket: StorageBucket,
  fileName: string
): Promise<boolean> {
  const signedUrl = await createSignedDownloadUrl(publicUrl, bucket);
  if (!signedUrl) return false;
  await downloadFile(signedUrl, fileName);
  return true;
}

/**
 * Removes a file from storage given its public URL.
 * Returns the Supabase error if deletion fails, or `null` on success.
 */
export async function removeStorageFile(
  publicUrl: string,
  bucket: StorageBucket
): Promise<{ message: string } | null> {
  const path = extractStoragePath(publicUrl, bucket);
  if (!path) return { message: 'Could not resolve storage path from URL' };

  const { error } = await supabase.storage.from(bucket).remove([path]);
  return error ? { message: error.message } : null;
}
