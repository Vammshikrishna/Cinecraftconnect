import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X, Image, Video, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PortfolioItemData {
  id: string;
  title: string;
  description?: string;
  media_url?: string;
  media_type?: string;
  project_type?: string;
  role?: string;
  completion_date?: string;
  tags?: string[];
}

interface PortfolioUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: PortfolioItemData) => void;
  itemToEdit?: PortfolioItemData | null;
}

const PortfolioUploadDialog = ({ isOpen, onOpenChange, onSave, itemToEdit }: PortfolioUploadDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setTitle(itemToEdit.title);
      setDescription(itemToEdit.description || "");
      setFilePreview(itemToEdit.media_url || null);
    } else {
      setTitle("");
      setDescription("");
      setFile(null);
      setFilePreview(null);
    }
  }, [itemToEdit, isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-10 w-10" />;
    if (type.startsWith('video/')) return <Video className="h-10 w-10" />;
    return <FileText className="h-10 w-10" />;
  };

  const handleSubmit = async () => {
    if (!user || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a title.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let media_url = itemToEdit?.media_url;
    let media_type = itemToEdit?.media_type;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('portfolio-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('portfolio-media').getPublicUrl(fileName);
        media_url = urlData.publicUrl;
        media_type = file.type;
      }

      const itemData = {
        user_id: user.id,
        title,
        description,
        media_url,
        media_type,
      };

      const { data, error } = await supabase
        .from('portfolio_items')
        .upsert(itemToEdit ? { ...itemData, id: itemToEdit.id } : itemData)
        .select()
        .single();
      
      if (error) throw error;

      toast({
        title: `Portfolio ${itemToEdit ? 'updated' : 'added'}!`,
        description: "Your portfolio has been successfully updated.",
      });
      onSave(data as PortfolioItemData);
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>{itemToEdit ? "Edit" : "Upload"} Portfolio Item</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g., 'Sunset Over The Mountains'" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isUploading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Describe your work, your role, and the project's context." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={isUploading} />
          </div>

          <div className="space-y-2">
            <Label>Media File</Label>
            {!filePreview ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => document.getElementById('file-upload')?.click()}>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">Click to upload a file</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF, MP4, PDF, etc.</p>
                <Input type="file" accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" id="file-upload" disabled={isUploading} />
              </div>
            ) : (
              <div className="p-2 bg-muted rounded-lg relative">
                <div className="flex items-center space-x-4">
                  {file ? getFileIcon(file.type) : (itemToEdit?.media_type && getFileIcon(itemToEdit.media_type))}
                  <div className="flex-grow">
                    <p className="text-sm font-medium">{file?.name || itemToEdit?.title}</p>
                    {file && <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile} disabled={isUploading} className="absolute top-2 right-2">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isUploading ? "Saving..." : "Save Portfolio Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioUploadDialog;
