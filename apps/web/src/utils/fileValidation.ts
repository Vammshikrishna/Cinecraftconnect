import { z } from 'zod';

// File size limits in bytes (Aggressive egress bandwidth protection)
export const FILE_SIZE_LIMITS = {
  image: 8 * 1024 * 1024, // 8MB original max before compression
  video: 12 * 1024 * 1024, // 12MB max for video egress protection
  file: 10 * 1024 * 1024, // 10MB
  audio: 10 * 1024 * 1024, // 10MB
};

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  // SVG is deliberately not allowed: it can carry script when served inline.
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  file: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

/** Extensions that are never accepted, whatever MIME type the file claims (programs, scripts, installers, web pages, SVG). */
export const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'msp', 'dll', 'sys', 'pif', 'cpl', 'lnk', 'reg', 'inf',
  'js', 'mjs', 'cjs', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'csh', 'php', 'phtml', 'py', 'pl', 'rb',
  'jar', 'class', 'apk', 'aab', 'ipa', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'bin', 'run', 'hta', 'gadget',
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'svgz', 'xml', 'xsl', 'swf',
  'docm', 'xlsm', 'pptm',
];

/** The real extension is the last segment of the name; trailing dots and spaces are ignored (Windows drops them). */
export const fileExtension = (name: string): string => {
  const clean = String(name ?? '').replace(/[\s.]+$/g, '');
  const i = clean.lastIndexOf('.');
  return i < 0 ? '' : clean.slice(i + 1).toLowerCase();
};

/**
 * Every dot-separated segment after the first is treated as an extension, so a double extension such as `name.exe.txt`
 * is refused too (F-01). Normal names with dots (`my.script.v2.pdf`) still pass.
 */
export const hasBlockedExtension = (name: string): boolean => {
  const clean = String(name ?? '').replace(/[\s.]+$/g, '');
  const segments = clean.split('.').slice(1).map((seg) => seg.trim().toLowerCase());
  return segments.some((seg) => BLOCKED_EXTENSIONS.includes(seg));
};

export const fileValidationSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, 'Must be a file'),
  type: z.enum(['image', 'video', 'file', 'audio']),
});

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: 'image' | 'video' | 'file' | 'audio';
}

export const validateFile = (file: File): FileValidationResult => {
  // Determine file type category
  let fileType: 'image' | 'video' | 'file' | 'audio' = 'file';
  
  if (file.type.startsWith('image/')) {
    fileType = 'image';
  } else if (file.type.startsWith('video/')) {
    fileType = 'video';
  } else if (file.type.startsWith('audio/')) {
    fileType = 'audio';
  }

  // Check if file type is allowed
  const allowedTypes = ALLOWED_FILE_TYPES[fileType];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // Check file size
  const sizeLimit = FILE_SIZE_LIMITS[fileType];
  if (file.size > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${fileMB}MB) exceeds the limit of ${limitMB}MB for ${fileType} files`,
    };
  }

  // Validate the file name for security. The declared MIME type comes from the browser (or the sender) and cannot be
  // trusted on its own, so the real extension (the part after the LAST dot) is checked as well.
  if (hasBlockedExtension(file.name)) {
    return {
      valid: false,
      error: 'File type not allowed for security reasons',
    };
  }

  return {
    valid: true,
    fileType,
  };
};

export interface UploadOptions {
  isThumbnail?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export const uploadFileToSupabase = async (
  file: File,
  bucket: string,
  path: string,
  options?: UploadOptions
): Promise<{ url: string | null; error: string | null }> => {
  const validation = validateFile(file);
  
  if (!validation.valid) {
    return { url: null, error: validation.error || 'Invalid file' };
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { compressImage } = await import('./imageCompression');
    
    // Compress image if it is an image file
    let fileToUpload = file;
    if (validation.fileType === 'image') {
      const maxWidth = options?.maxWidth || (options?.isThumbnail ? 400 : 1200);
      const maxHeight = options?.maxHeight || (options?.isThumbnail ? 400 : 1200);
      const quality = options?.quality || (options?.isThumbnail ? 0.70 : 0.70);
      fileToUpload = await compressImage(file, maxWidth, maxHeight, quality);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    // 128 bits from the CSPRNG: public-bucket URLs must not be guessable/enumerable.
    const randomString = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const extension = fileToUpload.name.split('.').pop();
    const filename = `${timestamp}-${randomString}.${extension}`;
    const fullPath = `${path}/${filename}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, fileToUpload, {
        cacheControl: '31536000',
        upsert: false,
      });

    if (error) {
      return { url: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    return { url: null, error: 'Failed to upload file' };
  }
};