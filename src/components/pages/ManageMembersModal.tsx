import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, UserMinus, Search, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  pageId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  existingMembers: any[];
}

export function ManageMembersModal({ pageId, isOpen, onOpenChange, existingMembers }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  // Use debounce for search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, craft')
        .ilike('full_name', `%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('company_page_members' as any)
        .insert({
          page_id: pageId,
          user_id: userId,
          title: title || 'Team Member',
          department: department || 'General'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member added successfully"
      });

      setSearchQuery('');
      setSearchResults([]);
      setTitle('');
      setDepartment('');
      queryClient.invalidateQueries({ queryKey: ['page-members', pageId] });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not add member",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('company_page_members' as any)
        .delete()
        .eq('page_id', pageId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed"
      });
      queryClient.invalidateQueries({ queryKey: ['page-members', pageId] });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not remove member",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const existingMemberIds = new Set(existingMembers.map(m => m.user_id));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            Manage Team
          </DialogTitle>
          <DialogDescription>
            Add or remove members from your company page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-4 border rounded-xl p-4 bg-muted/20 border-border">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add New Member</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Job Title</Label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g. Director" 
                  className="h-8 text-sm bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Input 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)} 
                  placeholder="e.g. Production" 
                  className="h-8 text-sm bg-background border-border" 
                />
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 mt-4">
                {searchResults.map(result => {
                  const isExisting = existingMemberIds.has(result.id);
                  return (
                    <div key={result.id} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={result.avatar_url || ''} />
                          <AvatarFallback>{result.full_name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-medium text-sm truncate">{result.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.craft || result.username}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={isExisting ? "secondary" : "default"}
                        disabled={isExisting || isLoading}
                        onClick={() => handleAddMember(result.id)}
                        className="flex-shrink-0"
                      >
                        {isExisting ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {searchQuery.trim().length > 2 && !isSearching && searchResults.length === 0 && (
              <p className="text-sm text-center text-muted-foreground mt-2">No users found.</p>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Members</h4>
            {existingMembers.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">No members yet.</p>
            ) : (
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                {existingMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profiles?.avatar_url || ''} />
                        <AvatarFallback>{member.profiles?.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className="font-medium text-sm truncate">{member.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.title} • {member.department}</p>
                      </div>
                    </div>
                    {member.user_id !== user?.id && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={isLoading}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto rounded-xl">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
