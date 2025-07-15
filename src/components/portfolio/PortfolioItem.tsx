import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Edit2, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}

export const PortfolioItem = ({
  id,
  title,
  description,
  mediaUrl,
  mediaType,
  projectType,
  role,
  completionDate,
  tags,
  isFeatured,
  isOwner,
  onEdit,
  onDelete,
  onView
}: PortfolioItemProps) => {
  const renderMedia = () => {
    if (!mediaUrl) return null;

    switch (mediaType) {
      case 'image':
        return (
          <img 
            src={mediaUrl} 
            alt={title}
            className="w-full h-48 object-cover rounded-md"
          />
        );
      case 'video':
        return (
          <video 
            src={mediaUrl} 
            className="w-full h-48 object-cover rounded-md"
            controls
          />
        );
      case 'audio':
        return (
          <audio 
            src={mediaUrl} 
            className="w-full"
            controls
          />
        );
      default:
        return (
          <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center">
            <span className="text-muted-foreground">Document</span>
          </div>
        );
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      {isFeatured && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary">Featured</Badge>
        </div>
      )}
      
      <CardContent className="p-4">
        {mediaUrl && (
          <div className="mb-4 relative">
            {renderMedia()}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onView?.(id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-lg leading-tight">{title}</h3>
            {isOwner && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit?.(id)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete?.(id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {description && (
            <p className="text-muted-foreground text-sm line-clamp-3">
              {description}
            </p>
          )}
          
          <div className="flex gap-2 text-sm text-muted-foreground">
            {projectType && <span>{projectType}</span>}
            {role && <span>• {role}</span>}
          </div>
          
          {completionDate && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(completionDate), 'MMM yyyy')}</span>
            </div>
          )}
        </div>
      </CardContent>
      
      {tags && tags.length > 0 && (
        <CardFooter className="pt-0 px-4 pb-4">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};