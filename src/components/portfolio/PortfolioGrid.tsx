import { useState, useEffect } from "react";
import { PortfolioItem } from "./PortfolioItem";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PortfolioItemDetail } from "./PortfolioItemDetail";
import PortfolioUploadDialog from "./PortfolioUploadDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
}

export const PortfolioGrid = ({ userId, isOwner = false }: PortfolioGridProps) => {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PortfolioItemData | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PortfolioItemData | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const fetchPortfolioItems = async () => {
    try {
      let query = supabase.from('portfolio_items').select('*').order('created_at', { ascending: false });
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      setPortfolioItems(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load portfolio items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioItems();
  }, [userId]);

  const handleView = (id: string) => {
    const item = portfolioItems.find(item => item.id === id);
    if (item) {
      setSelectedItem(item);
      setIsDetailViewOpen(true);
    }
  };

  const handleAddNew = () => {
    setItemToEdit(null);
    setIsUploadDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const item = portfolioItems.find(item => item.id === id);
    if (item) {
      setItemToEdit(item);
      setIsUploadDialogOpen(true);
    }
  };
  
  const handleSave = (savedItem: PortfolioItemData) => {
    const index = portfolioItems.findIndex(item => item.id === savedItem.id);
    if (index > -1) {
      setPortfolioItems(prev => prev.map(item => item.id === savedItem.id ? savedItem : item));
    } else {
      setPortfolioItems(prev => [savedItem, ...prev]);
    }
    fetchPortfolioItems(); // Re-fetch to ensure data consistency
  };

  const openDeleteDialog = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { error } = await supabase.from('portfolio_items').delete().eq('id', itemToDelete);
      if (error) throw error;
      setPortfolioItems(portfolioItems.filter(item => item.id !== itemToDelete));
      toast({ title: "Success", description: "Portfolio item deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete portfolio item", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Portfolio</h2>
          <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" />Add New Item</Button>
        </div>
      )}

      {portfolioItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{isOwner ? "You haven't added any portfolio items yet." : "No portfolio items to display."}</p>
          {isOwner && <Button onClick={handleAddNew} variant="outline"><Plus className="mr-2 h-4 w-4" />Add Your First Item</Button>}
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
              isOwner={isOwner}
              onEdit={handleEdit}
              onDelete={openDeleteDialog}
              onView={handleView}
            />
          ))}
        </div>
      )}

      <PortfolioItemDetail item={selectedItem} isOpen={isDetailViewOpen} onOpenChange={setIsDetailViewOpen} />
      <PortfolioUploadDialog isOpen={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} onSave={handleSave} itemToEdit={itemToEdit} />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete your portfolio item.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
