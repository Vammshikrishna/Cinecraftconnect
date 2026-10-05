import { Linking } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../config/env';
import type { PickedAttachment } from './attachmentPicker';

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const token32 = (): string => {
  const bytes = new Uint8Array(16);
  const c: any = (globalThis as any).crypto || (globalThis as any).nativeCrypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Uploads a CV / portfolio file to the private `resumes` bucket under `<userId>/…` (the storage policy only lets people
 * write to their own folder) and returns the reference stored on the application: `resumes:<path>`.
 * The same format the web app writes, so both apps can open each other's files.
 */
async function uploadPrivate(bucket: string, file: PickedAttachment): Promise<string> {
  if (file.size && file.size > RESUME_MAX_BYTES) throw new Error('Please attach a file up to 10 MB.');
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const userId = sessionData?.session?.user?.id;
  if (!accessToken || !userId) throw new Error('Please sign in again to upload your file.');

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${userId}/${token32()}.${ext}`;

  const form = new FormData();
  form.append('file', { uri: file.uri, name: `resume.${ext}`, type: file.type || 'application/octet-stream' } as any);

  const res = await fetch(`${ENV.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: ENV.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'cache-control': 'max-age=31536000' },
    body: form,
  });
  if (!res.ok) throw new Error('Could not upload the file. Please try again.');
  return `${bucket}:${path}`;
}

export const uploadResume = (file: PickedAttachment): Promise<string> => uploadPrivate('resumes', file);
/** Business document for vendor verification (private bucket, only the owner and admins can read it). */
export const uploadVendorDoc = (file: PickedAttachment): Promise<string> => uploadPrivate('vendor_docs', file);
/** Company document for page verification (private bucket, only the owner and admins can read it). */
export const uploadPageDoc = (file: PickedAttachment): Promise<string> => uploadPrivate('page_docs', file);

/** Resolves a stored reference (`resumes:<path>` or a legacy public URL) into a short-lived signed link and opens it. */
export async function openResume(ref: string): Promise<void> {
  let path = ref;
  if (ref.startsWith('resumes:')) path = ref.slice('resumes:'.length);
  else {
    const m = ref.match(/\/resumes\/(.+?)(?:\?|$)/);
    if (!m) {
      await Linking.openURL(ref);
      return;
    }
    path = decodeURIComponent(m[1]);
  }
  const { data, error } = await getSupabaseClient().storage.from('resumes').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('Could not open the file.');
  await Linking.openURL(data.signedUrl);
}

/** Screenshot for a support request (private `support` bucket, same `support:<path>` reference the web app writes). */
export async function uploadSupportAttachment(file: PickedAttachment): Promise<string> {
  if (file.size && file.size > 5 * 1024 * 1024) throw new Error('Please attach a screenshot up to 5 MB.');
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const userId = sessionData?.session?.user?.id;
  if (!accessToken || !userId) throw new Error('Please sign in again to upload your file.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `support-attachments/${userId}-${token32()}.${ext}`;
  const form = new FormData();
  form.append('file', { uri: file.uri, name: `shot.${ext}`, type: file.type || 'image/jpeg' } as any);
  const res = await fetch(`${ENV.SUPABASE_URL}/storage/v1/object/support/${path}`, {
    method: 'POST',
    headers: { apikey: ENV.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'cache-control': 'max-age=31536000' },
    body: form,
  });
  if (!res.ok) throw new Error('Could not upload the screenshot. Please try again.');
  return `support:${path}`;
}

export async function signedSupportUrl(ref: string): Promise<string | null> {
  const path = ref.startsWith('support:') ? ref.slice('support:'.length) : ref;
  const { data } = await getSupabaseClient().storage.from('support').createSignedUrl(path, 600);
  return data?.signedUrl || null;
}
