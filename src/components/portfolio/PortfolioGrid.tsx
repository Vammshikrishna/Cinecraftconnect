import { useState, useEffect } from "react";
import { PortfolioItem } from "./PortfolioItem";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  is_featured?: boolean;
  user_id: string;
}

interface PortfolioGridProps {
  userId?: string;
  isOwner?: boolean;
  onAddNew?: () => void;
}

export const PortfolioGrid = ({ userId, isOwner = false, onAddNew }: PortfolioGridProps) => {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPortfolioItems = async () => {
    try {
      let query = supabase
        .from('portfolio_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setPortfolioItems(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load portfolio items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioItems();
  }, [userId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this portfolio item?")) return;

    try {
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPortfolioItems(portfolioItems.filter(item => item.id !== id));
      toast({
        title: "Success",
        description: "Portfolio item deleted successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete portfolio item",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Portfolio</h2>
          <Button onClick={onAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Item
          </Button>
        </div>
      )}

      {portfolioItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {isOwner ? "You haven't added any portfolio items yet." : "No portfolio items to display."}
          </p>
          {isOwner && (
            <Button onClick={onAddNew} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolioItems.map((item) => (
            <PortfolioItem
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              mediaUrl={item.media_url}
              mediaType={item.media_type as 'image' | 'video' | 'audio' | 'document'}
              projectType={item.project_type}
              role={item.role}
              completionDate={item.completion_date}
              tags={item.tags}
              isFeatured={item.is_featured}
              isOwner={isOwner}
              onEdit={(id) => console.log('Edit', id)}
              onDelete={handleDelete}
              onView={(id) => console.log('View', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};