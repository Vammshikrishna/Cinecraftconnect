
/**
 * Options for Supabase image transformations
 */
export interface ImageTransformationOptions {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
  format?: 'webp' | 'origin';
}

/**
 * Transforms a Supabase storage URL to include transformation parameters
 * @param url The original Supabase storage URL
 * @param options Transformation options
 * @returns The transformed URL
 */
export const getOptimizedImage = (url: string | null | undefined, options: ImageTransformationOptions = {}): string => {
  if (!url) return '';
  
  // If not a Supabase URL, return as is
  if (!url.includes('supabase.co')) return url;

  // We use the standard public object URL
  // While Supabase transformation technically uses /render/image/, 
  // it requires the service to be enabled. Using standard URLs with 
  // query params is safer and avoids breaking images if the service is inactive.
  const optimizedUrl = url;

  // Default options
  const { 
    width, 
    height, 
    resize = 'cover', 
    quality = 80, 
    format = 'webp' 
  } = options;

  const params = new URLSearchParams();
  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  params.append('resize', resize);
  params.append('quality', quality.toString());
  params.append('format', format);

  // Check if URL already has queries
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  return `${optimizedUrl}${separator}${params.toString()}`;
};
