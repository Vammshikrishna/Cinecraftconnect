import { pickAttachments } from './attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
import { uploadMediaPipeline } from './mediaPipeline';

/**
 * Utility function to launch native image picker,
 * compress the image, upload to Supabase Storage with 1-year cache headers,
 * and return the public URL.
 * 
 * @param bucket Storage bucket name (default: 'portfolios')
 * @param folder Storage folder path prefix (default: 'uploads')
 * @returns Promise<string | null> The public URL of the uploaded image, or null if cancelled/failed.
 */
export const pickAndUploadImage = async (
  bucket: string = 'portfolios',
  folder: string = 'uploads'
): Promise<string | null> => {
  try {
    const [res] = await pickAttachments({ multiple: false, allowFiles: false, photosOnly: true });

    if (!res || !res.uri) return null;

    const uploaded = await uploadMediaPipeline(
      {
        uri: res.uri,
        name: res.name || 'image.jpg',
        type: res.type || 'image/jpeg',
        size: res.size || 0,
      },
      {
        bucket,
        folder,
      }
    );

    return uploaded?.url || null;
  } catch (err: any) {
    if (!DocumentPicker.isCancel(err)) {
      console.warn('[imageUploadService] Image upload failed:', err);
    }
    return null;
  }
};
