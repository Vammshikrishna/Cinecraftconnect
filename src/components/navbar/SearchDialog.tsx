import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Briefcase, FileText, Hash, X } from "lucide-react";

interface SearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  type: 'user' | 'project' | 'post' | 'hashtag';
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

type SearchFilter = 'all' | 'user' | 'project' | 'post';

const SearchDialog = ({ isOpen, onOpenChange }: SearchDialogProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');

  const searchDelay = 300; // ms

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.length > 1) {
        performSearch(searchQuery, activeFilter);
      } else {
        setSearchResults([]);
      }
    }, searchDelay);

    return () => clearTimeout(handler);
  }, [searchQuery, activeFilter]);

  const performSearch = async (query: string, filter: SearchFilter) => {
    setLoading(true);
    try {
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      // Search Users
      if (filter === 'all' || filter === 'user') {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, craft')
          .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
          .limit(5);
        data?.forEach(p => results.push({ type: 'user', id: p.id, title: p.full_name || p.username || 'User', subtitle: p.craft || `@${p.username}`, icon: User }));
      }

      // Search Projects
      if (filter === 'all' || filter === 'project') {
        const { data } = await supabase
          .from('projects')
          .select('id, title, status')
          .ilike('title', `%${query}%`)
          .eq('is_public', true)
          .limit(5);
        data?.forEach(p => results.push({ type: 'project', id: p.id, title: p.title, subtitle: `Status: ${p.status}`, icon: Briefcase }));
      }

      // Search Posts
      if (filter === 'all' || filter === 'post') {
        const { data } = await supabase
          .from('posts')
          .select('id, content, profiles(full_name, username)')
          .ilike('content', `%${query}%`)
          .limit(5);
        data?.forEach((p: any) => results.push({ type: 'post', id: p.id, title: p.content.substring(0, 60) + '...', subtitle: `By ${p.profiles?.full_name || p.profiles?.username || 'user'}`, icon: FileText }));
      }

      // Hashtag Suggestion
      if (query.startsWith('#')) {
        results.unshift({ type: 'hashtag', id: query.slice(1), title: query, subtitle: 'Search for this tag', icon: Hash });
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onOpenChange(false);
    switch (result.type) {
      case 'user': return navigate(`/profile/view?user=${result.id}`);
      case 'project': return navigate(`/projects/${result.id}`);
      case 'post': return navigate(`/feed?highlight=${result.id}`);
      case 'hashtag': return navigate(`/feed?tag=${result.id}`);
    }
  };

  const filterOptions: { id: SearchFilter, label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'user', label: 'People' },
    { id: 'project', label: 'Projects' },
    { id: 'post', label: 'Posts' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center p-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground mr-3" />
            <Input
              placeholder="Search CineCraft Connect..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 shadow-none p-0 text-base h-auto bg-transparent"
              autoFocus
            />
            {searchQuery && (
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setSearchQuery('')}>
                    <X className="h-4 w-4"/>
                </Button>
            )}
        </div>

        <div className="p-2 border-b">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium px-2">Filters:</span>
                {filterOptions.map(opt => (
                    <Button 
                        key={opt.id} 
                        variant={activeFilter === opt.id ? 'secondary' : 'ghost'} 
                        size="sm"
                        onClick={() => setActiveFilter(opt.id)}
                        className="text-xs h-7"
                    >
                        {opt.label}
                    </Button>
                ))}
            </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>}
          
          {!loading && searchQuery && (
            searchResults.length > 0 ? (
              <ul className="py-2">
                {searchResults.map((result) => {
                  const Icon = result.icon;
                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        className="w-full flex items-center gap-3 text-left p-3 hover:bg-accent transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">No results for "{searchQuery}"</p>
            )
          )}

          {!searchQuery && !loading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
                <p>Find professionals, projects, and discussions.</p>
                <p className="text-xs mt-2">Use # to search for specific tags.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
