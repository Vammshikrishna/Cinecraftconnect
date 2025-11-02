import { z } from 'zod';

// File size limits in bytes
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  file: 50 * 1024 * 1024, // 50MB
  audio: 20 * 1024 * 1024, // 20MB
};

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
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

  // Validate file name for security
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.jar'];
  const hassDangerousExtension = dangerousExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  if (hassDangerousExtension) {
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

export const uploadFileToSupabase = async (
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string | null; error: string | null }> => {
  const validation = validateFile(file);
  
  if (!validation.valid) {
    return { url: null, error: validation.error || 'Invalid file' };
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${randomString}.${extension}`;
    const fullPath = `${path}/${filename}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, file, {
        cacheControl: '3600',
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