/**
 * Compresses a video file on the client side using HTML5 Canvas & MediaRecorder API.
 * Reduces resolution to max 720p and lowers bitrate to ~1.5 Mbps.
 * 
 * @param file The original video file.
 * @param maxDimension The max width/height (defaults to 1280 for 720p).
 * @param targetBitrate The target bitrate in bps (defaults to 1,500,000 = 1.5 Mbps).
 * @returns A promise that resolves to the compressed video File.
 */
export const compressVideo = (
  file: File,
  maxDimension = 1280,
  targetBitrate = 1500000
): Promise<File> => {
  return new Promise((resolve) => {
    // If not browser or no MediaRecorder / HTMLVideoElement, resolve original
    if (typeof window === 'undefined' || !window.MediaRecorder || !window.URL) {
      return resolve(file);
    }

    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;

      // Downscale resolution if larger than maxDimension (e.g. 4K/1080p -> 720p)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Ensure dimensions are even (required for video encoders)
      width = width % 2 === 0 ? width : width - 1;
      height = height % 2 === 0 ? height : height - 1;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        return resolve(file);
      }

      // Check supported MIME types for recording
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];
      const selectedMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';

      if (!selectedMime) {
        URL.revokeObjectURL(videoUrl);
        return resolve(file);
      }

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(30); // 30 FPS
      } catch (err) {
        URL.revokeObjectURL(videoUrl);
        return resolve(file);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: targetBitrate,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        URL.revokeObjectURL(videoUrl);
        const compressedBlob = new Blob(chunks, { type: selectedMime });

        // If compressed file is larger or equal to original, return original
        if (compressedBlob.size >= file.size) {
          console.log(`[VideoCompression] Compressed video size (${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB) >= original (${(file.size / 1024 / 1024).toFixed(2)} MB). Keeping original.`);
          return resolve(file);
        }

        console.log(`[VideoCompression] Successfully compressed "${file.name}" from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - compressedBlob.size / file.size) * 100)}% size reduction).`);

        const ext = selectedMime.includes('mp4') ? '.mp4' : '.webm';
        const newName = file.name.replace(/\.[^/.]+$/, '') + '_compressed' + ext;
        const compressedFile = new File([compressedBlob], newName, {
          type: selectedMime,
          lastModified: Date.now(),
        });
        resolve(compressedFile);
      };

      // Draw frames onto canvas as video plays
      let animFrameId: number;
      const drawFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, width, height);
          animFrameId = requestAnimationFrame(drawFrame);
        }
      };

      video.onplay = () => {
        drawFrame();
      };

      video.onended = () => {
        cancelAnimationFrame(animFrameId);
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      video.onerror = () => {
        cancelAnimationFrame(animFrameId);
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        resolve(file);
      };

      mediaRecorder.start(100);
      video.play().catch(() => resolve(file));
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      resolve(file);
    };
  });
};
