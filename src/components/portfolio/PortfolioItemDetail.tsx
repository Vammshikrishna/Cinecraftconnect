import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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

interface PortfolioItemDetailProps {
  item: PortfolioItemData | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PortfolioItemDetail = ({ item, isOpen, onOpenChange }: PortfolioItemDetailProps) => {
  if (!item) return null;

  const renderMedia = () => {
    if (!item.media_url) return <div className="w-full h-64 bg-muted flex items-center justify-center text-muted-foreground">No media available</div>;

    if (item.media_type?.startsWith('image')) {
      return <img src={item.media_url} alt={item.title} className="rounded-lg object-cover w-full h-auto" />;
    } else if (item.media_type?.startsWith('video')) {
      return <video src={item.media_url} controls className="rounded-lg w-full" />;
    } else {
      return <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View File</a>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold mb-4">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {renderMedia()}
          </div>
          <div>
            <DialogDescription className="text-lg mb-4">{item.description}</DialogDescription>
            <div className="space-y-4">
              {item.project_type && <div><h4 className="font-semibold">Project Type</h4><p>{item.project_type}</p></div>}
              {item.role && <div><h4 className="font-semibold">My Role</h4><p>{item.role}</p></div>}
              {item.completion_date && <div><h4 className="font-semibold">Completed On</h4><p>{new Date(item.completion_date).toLocaleDateString()}</p></div>}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
