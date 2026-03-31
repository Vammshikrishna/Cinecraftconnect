import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Image, Video, X, Upload } from "lucide-react";

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface MediaUploadProps {
    onMediaUpload: (mediaItems: MediaItem[]) => void;
    disabled?: boolean;
}

const MediaUpload = ({ onMediaUpload, disabled }: MediaUploadProps) => {
    const [uploading, setUploading] = useState(false);
    const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
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
            const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            // Upload file to storage
            const { error: uploadError } = await supabase.storage
                .from('portfolios')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data } = supabase.storage
                .from('portfolios')
                .getPublicUrl(filePath);

            const mediaUrl = data.publicUrl;
            const newItem: MediaItem = { url: mediaUrl, type };

            const updatedList = [...uploadedMedia, newItem];
            setUploadedMedia(updatedList);
            onMediaUpload(updatedList);

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
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                if (!file.type.startsWith('image/')) {
                    toast({
                        title: "Invalid file type",
                        description: `"${file.name}" is not an image`,
                        variant: "destructive",
                    });
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    toast({
                        title: "File too large",
                        description: `"${file.name}" is larger than 10MB`,
                        variant: "destructive",
                    });
                    return;
                }
                uploadFile(file, 'image');
            });
        }
    };

    const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                if (!file.type.startsWith('video/')) {
                    toast({
                        title: "Invalid file type",
                        description: `"${file.name}" is not a video`,
                        variant: "destructive",
                    });
                    return;
                }
                if (file.size > 100 * 1024 * 1024) {
                    toast({
                        title: "File too large",
                        description: `"${file.name}" is larger than 100MB`,
                        variant: "destructive",
                    });
                    return;
                }
                uploadFile(file, 'video');
            });
        }
    };

    const removeMedia = (index: number) => {
        const updatedList = uploadedMedia.filter((_, i) => i !== index);
        setUploadedMedia(updatedList);
        onMediaUpload(updatedList);
    };

    return (
        <div className="space-y-4">
            {/* Media previews grid */}
            {uploadedMedia.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {uploadedMedia.map((item, index) => (
                        <div key={index} className="relative aspect-video border border-border/40 rounded-xl overflow-hidden group shadow-sm">
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1.5 right-1.5 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-lg"
                                onClick={() => removeMedia(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>

                            {item.type === 'image' ? (
                                <img
                                    src={item.url}
                                    alt={`Upload ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                                />
                            ) : (
                                <div className="relative w-full h-full bg-black/20">
                                    <video
                                        src={item.url}
                                        className="w-full h-full object-cover"
                                        onMouseOver={e => e.currentTarget.play()}
                                        onMouseOut={e => e.currentTarget.pause()}
                                        muted
                                        loop
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-black/50 backdrop-blur-sm p-1.5 rounded-full">
                                            <Video className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {uploading && (
                        <div className="aspect-video border border-dashed border-border flex items-center justify-center rounded-xl bg-white/5">
                            <Upload className="w-5 h-5 text-muted-foreground animate-bounce" />
                        </div>
                    )}
                </div>
            )}

            {/* Upload buttons */}
            <div className="flex flex-wrap gap-2">
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={disabled || uploading}
                />
                <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoSelect}
                    className="hidden"
                    disabled={disabled || uploading}
                />

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="glass-button border-border/40 text-xs py-4 px-4 h-9"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={disabled || uploading}
                >
                    {uploading ? (
                        <Upload className="w-3.5 h-3.5 mr-2 animate-spin text-primary" />
                    ) : (
                        <Image className="w-3.5 h-3.5 mr-2 text-primary" />
                    )}
                    Add Images
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="glass-button border-border/40 text-xs py-4 px-4 h-9"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={disabled || uploading}
                >
                    {uploading ? (
                        <Upload className="w-3.5 h-3.5 mr-2 animate-spin text-primary" />
                    ) : (
                        <Video className="w-3.5 h-3.5 mr-2 text-primary" />
                    )}
                    Add Videos
                </Button>
            </div>
        </div>
    );
};

export default MediaUpload;