import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Hash, Briefcase, FileText } from "lucide-react";

interface SearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  type: 'user' | 'project' | 'post' | 'hashtag';
  id: string;
  title: string;
  subtitle: string;
  icon: any;
}

const SearchDialog = ({ isOpen, onOpenChange }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search function
  useEffect(() => {
    const searchDelayTimer = setTimeout(() => {
      if (searchQuery.length > 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchDelayTimer);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setLoading(true);
    try {
      const results: SearchResult[] = [];

      // Search users/profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, craft')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,craft.ilike.%${query}%`)
        .limit(5);

      if (profiles) {
        profiles.forEach(profile => {
          results.push({
            type: 'user',
            id: profile.id,
            title: profile.full_name || profile.username || 'Anonymous User',
            subtitle: profile.craft || 'Creator',
            icon: User
          });
        });
      }

      // Search projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, status')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_public', true)
        .limit(5);

      if (projects) {
        projects.forEach(project => {
          results.push({
            type: 'project',
            id: project.id,
            title: project.title,
            subtitle: project.description?.slice(0, 50) + '...' || `Status: ${project.status}`,
            icon: Briefcase
          });
        });
      }

      // Search posts
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          id, 
          content,
          profiles:author_id (full_name, username)
        `)
        .ilike('content', `%${query}%`)
        .limit(5);

      if (posts) {
        posts.forEach((post: any) => {
          const authorName = post.profiles?.full_name || post.profiles?.username || 'Anonymous';
          results.push({
            type: 'post',
            id: post.id,
            title: post.content.slice(0, 50) + '...',
            subtitle: `by ${authorName}`,
            icon: FileText
          });
        });
      }

      // Add hashtag suggestions if query starts with #
      if (query.startsWith('#')) {
        const hashtag = query.slice(1);
        results.push({
          type: 'hashtag',
          id: hashtag,
          title: `#${hashtag}`,
          subtitle: 'Search for this hashtag',
          icon: Hash
        });
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    console.log('Selected search result:', result);
    
    // Here you could navigate to different pages based on result type
    switch (result.type) {
      case 'user':
        // Navigate to user profile
        window.location.href = `/profile?user=${result.id}`;
        break;
      case 'project':
        // Navigate to project details
        window.location.href = `/projects?id=${result.id}`;
        break;
      case 'post':
        // Navigate to post or feed with highlight
        window.location.href = `/feed?highlight=${result.id}`;
        break;
      case 'hashtag':
        // Navigate to feed with hashtag filter
        window.location.href = `/feed?tag=${result.id}`;
        break;
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-white/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Search</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search people, projects, posts, and more..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          {loading && (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}

          {searchQuery && !loading && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((result, index) => {
                  const IconComponent = result.icon;
                  return (
                    <Button
                      key={`${result.type}-${result.id}-${index}`}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 hover:bg-accent transition-colors"
                      onClick={() => handleResultClick(result)}
                    >
                      <IconComponent className="h-4 w-4 mr-3 text-muted-foreground flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      </div>
                    </Button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-muted-foreground">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {!searchQuery && (
            <div className="p-3 text-center text-muted-foreground">
              <p className="text-sm">Start typing to search for people, projects, or posts...</p>
              <p className="text-xs mt-1">Use # to search for hashtags</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;