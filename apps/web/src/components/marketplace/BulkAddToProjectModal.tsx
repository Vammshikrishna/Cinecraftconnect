import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceListing } from '@/types/marketplace';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Folder, Loader2 } from 'lucide-react';

interface BulkAddToProjectModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    selectedListings: MarketplaceListing[];
    onSuccess: () => void;
}

export const BulkAddToProjectModal = ({ isOpen, onOpenChange, selectedListings, onSuccess }: BulkAddToProjectModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const { data: projects, isLoading } = useQuery({
        queryKey: ['my_projects', user?.id],
        queryFn: async () => {
            if (!user) return [];
            // Fetch projects where user is creator
            const { data, error } = await supabase
                .from('project_spaces' as any)
                .select('id, title')
                .eq('creator_id', user.id);
            if (error) throw error;
            return data as unknown as { id: string, title: string }[];
        },
        enabled: !!user && isOpen
    });

    const handleBulkAdd = async () => {
        if (!selectedProjectId) {
            toast({ title: 'Select a project', description: 'Please select a project to add these items to.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const budgetItems = selectedListings.map(listing => ({
                project_id: selectedProjectId,
                category: 'Equipment',
                item_name: listing.title,
                estimated_cost: listing.price_per_day,
                notes: `Added from Wishlist - ${listing.category}\nLink: /marketplace/${listing.id}`
            }));

            const { error } = await supabase
                .from('budget_items' as any)
                .insert(budgetItems);

            if (error) throw error;

            toast({ title: 'Success', description: `Added ${selectedListings.length} items to the project gear list.` });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error adding to project:', error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-background border-border">
                <DialogHeader>
                    <DialogTitle>Add to Project Gear List</DialogTitle>
                    <DialogDescription>
                        Select a project to add the {selectedListings.length} selected item(s) to its budget/gear list.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : projects?.length === 0 ? (
                        <div className="text-center p-4 bg-secondary/20 rounded-xl">
                            <p className="text-sm text-muted-foreground">You don't have any projects yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projects?.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => setSelectedProjectId(project.id)}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                                        selectedProjectId === project.id 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                            : 'border-border/50 hover:bg-secondary/20 hover:border-border'
                                    }`}
                                >
                                    <Folder className={`h-5 w-5 ${selectedProjectId === project.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="font-bold flex-1">{project.title}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleBulkAdd} 
                        disabled={isSubmitting || !selectedProjectId || selectedListings.length === 0}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add to Project
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
