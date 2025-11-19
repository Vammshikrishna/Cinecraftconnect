import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Eye } from "lucide-react";

interface PortfolioItemProps {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  projectType?: string;
  role?: string;
  completionDate?: string;
  tags?: string[];
  isFeatured?: boolean;
  isOwner?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

export const PortfolioItem = ({
  id,
  title,
  mediaUrl,
  mediaType,
  isOwner,
  onEdit,
  onDelete,
  onView,
}: PortfolioItemProps) => {

  const MediaPreview = () => {
    if (!mediaUrl) return <div className="h-48 w-full bg-muted flex items-center justify-center text-muted-foreground">No Preview</div>;
    if (mediaType === 'image') return <img src={mediaUrl} alt={title} className="h-48 w-full object-cover" />;
    if (mediaType === 'video') return <div className="h-48 w-full bg-black flex items-center justify-center"><video src={mediaUrl} className="max-h-full max-w-full" /></div>;
    return <div className="h-48 w-full bg-muted flex items-center justify-center text-muted-foreground">{mediaType}</div>;
  };

  return (
    <Card className="overflow-hidden flex flex-col group relative">
      <div className="cursor-pointer" onClick={() => onView(id)}>
        <MediaPreview />
      </div>
      <CardHeader className="flex-grow">
        <CardTitle className="text-lg truncate">{title}</CardTitle>
      </CardHeader>
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {isOwner && (
          <>
            <Button size="icon" variant="secondary" onClick={() => onEdit(id)}><Edit className="h-4 w-4" /></Button>
            <Button size="icon" variant="destructive" onClick={() => onDelete(id)}><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
        <Button size="icon" variant="secondary" onClick={() => onView(id)}><Eye className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
};
