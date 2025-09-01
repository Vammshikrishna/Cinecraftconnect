import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Image, Video, X, Upload } from "lucide-react";

interface MediaUploadProps {
  onMediaUpload: (mediaUrl: string, mediaType: 'image' | 'video') => void;
  disabled?: boolean;
}

const MediaUpload = ({ onMediaUpload, disabled }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File, type: 'image' | 'video') => {
    try {
      setUploading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Create file path with user ID and timestamp
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('portfolios') // Using existing portfolios bucket
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('portfolios')
        .getPublicUrl(filePath);

      const mediaUrl = data.publicUrl;
      setUploadedMedia({ url: mediaUrl, type });
      onMediaUpload(mediaUrl, type);

      toast({
        title: "Success",
        description: `${type === 'image' ? 'Image' : 'Video'} uploaded successfully!`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      uploadFile(file, 'image');
    }
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a video file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a video smaller than 100MB",
          variant: "destructive",
        });
        return;
      }

      uploadFile(file, 'video');
    }
  };

  const removeMedia = () => {
    setUploadedMedia(null);
    onMediaUpload('', 'image');
    
    // Reset file inputs
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex space-x-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || uploading || !!uploadedMedia}
        >
          {uploading ? (
            <Upload className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Image className="w-4 h-4 mr-1" />
          )}
          Image
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border"
          onClick={() => videoInputRef.current?.click()}
          disabled={disabled || uploading || !!uploadedMedia}
        >
          {uploading ? (
            <Upload className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Video className="w-4 h-4 mr-1" />
          )}
          Video
        </Button>
      </div>

      {/* Media preview */}
      {uploadedMedia && (
        <div className="relative border border-border rounded-lg overflow-hidden">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 h-6 w-6"
            onClick={removeMedia}
          >
            <X className="h-3 w-3" />
          </Button>
          
          {uploadedMedia.type === 'image' ? (
            <img
              src={uploadedMedia.url}
              alt="Uploaded image"
              className="w-full max-h-48 object-cover"
            />
          ) : (
            <video
              src={uploadedMedia.url}
              controls
              className="w-full max-h-48"
            >
              Your browser does not support video playback.
            </video>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaUpload;