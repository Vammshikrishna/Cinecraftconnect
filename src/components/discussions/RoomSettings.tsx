
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RoomSettingsProps {
  roomId: string;
  currentTitle: string;
  currentDescription: string | null;
  currentCategory: string;
  categories: {id: string, name: string}[];
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
  onClose: () => void;
}

export const RoomSettings = ({ roomId, currentTitle, currentDescription, currentCategory, categories, onRoomUpdated, onClose }: RoomSettingsProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || '');
  const [categoryId, setCategoryId] = useState(currentCategory);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('discussion_rooms')
        .update({ title, description, category_id: categoryId })
        .eq('id', roomId);

      if (error) throw error;

      onRoomUpdated(roomId, title, description);
      toast({ title: "Success", description: "Room settings have been updated." });
      onClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('discussion_rooms').delete().eq('id', roomId);
      if (error) throw error;

      toast({ title: "Room Deleted", description: "The room has been permanently deleted." });
      // Instead of a dedicated onDelete prop, we can reuse onClose and let the parent handle the refresh.
      onClose(); 
    } catch (error: any) {
      toast({ title: "Error Deleting Room", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setConfirmingDelete(false);
    }
  };

  return (
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
              <DialogTitle>Room Settings</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
              <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">Room Name *</label>
                  <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                  <Input id="description" value={description} onChange={e => setDescription(e.target.value)} className="bg-gray-700 border-gray-600" />
              </div>
              <div>
                  <label htmlFor="category" className="block text-sm font-medium mb-1">Category *</label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="w-full bg-gray-700 border-gray-600">
                          <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                          {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          </div>
          <DialogFooter className="justify-between pt-4">
              {!isConfirmingDelete ? (
                <Button variant="destructive" onClick={() => setConfirmingDelete(true)} className="mr-auto">Delete Room</Button>
              ) : (
                <div className="mr-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirm Delete'}
                    </Button>
                </div>
              )}
              <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSave} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                  </Button>
              </div>
          </DialogFooter>
      </DialogContent>
  );
};
