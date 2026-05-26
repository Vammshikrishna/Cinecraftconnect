/**
 * Compresses an image file on the client side using a canvas.
 * Falls back to returning the original file if compression fails or if
 * the compressed file ends up being larger.
 * 
 * @param file The original image file.
 * @param maxWidth The maximum width for the compressed image (defaults to 1200).
 * @param maxHeight The maximum height for the compressed image (defaults to 1200).
 * @param quality The compression quality from 0 to 1 (defaults to 0.75).
 * @returns A promise that resolves to the compressed File.
 */
export const compressImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> => {
  return new Promise((resolve) => {
    // Check if browser environment supports canvas and file readers
    if (typeof window === 'undefined' || !window.HTMLCanvasElement || !window.FileReader) {
      return resolve(file);
    }

    // Skip compression for non-images and animated formats (like GIF) or vector formats (like SVG)
    if (
      !file.type.startsWith('image/') || 
      file.type === 'image/gif' || 
      file.type === 'image/svg+xml'
    ) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        // Draw image onto canvas (triggers scaling)
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP if supported, otherwise fallback to JPEG
        // WebP provides significantly better compression ratios than JPEG
        const outputType = 'image/jpeg';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            
            // Only use the compressed file if it actually reduces file size
            if (blob.size >= file.size) {
              console.log(`[Compression] Compressed size (${(blob.size / 1024).toFixed(1)} KB) is larger or equal to original (${(file.size / 1024).toFixed(1)} KB). Keeping original.`);
              return resolve(file);
            }

            console.log(`[Compression] Successfully compressed "${file.name}" from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(blob.size / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - blob.size / file.size) * 100)}% reduction).`);
            
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};
