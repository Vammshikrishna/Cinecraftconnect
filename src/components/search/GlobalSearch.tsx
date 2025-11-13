
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Basic type definitions for search results
interface ProjectResult {
  id: number;
  title: string;
  description: string;
  type: 'project';
}

interface UserResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  type: 'user';
}

type SearchResult = ProjectResult | UserResult;

const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [projectsRes, usersRes] = await Promise.all([
        supabase.from('projects').select('id, title, description').textSearch('title', searchQuery, { type: 'websearch' }),
        supabase.from('profiles').select('id, username, full_name, avatar_url').textSearch('username', searchQuery, { type: 'websearch' })
      ]);

      const projects = (projectsRes.data || []).map(p => ({ ...p, type: 'project' as const }));
      const users = (usersRes.data || []).map(u => ({ ...u, type: 'user' as const }));

      setResults([...projects, ...users]);
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="search"
          placeholder="Search for projects, people..."
          className="pl-10 pr-4 py-2 w-full bg-gray-800 border-gray-700 rounded-full focus:bg-gray-700 focus:border-purple-500 transition-all"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            performSearch(e.target.value);
          }}
        />
      </div>
      {query.length > 1 && (
        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
          {loading && <div className="p-4 text-center">Searching...</div>}
          {!loading && results.length === 0 && <div className="p-4 text-center">No results found.</div>}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-gray-700">
              {results.map(result => (
                <li key={`${result.type}-${result.id}`}>
                  {result.type === 'project' ? (
                    <Link to={`/projects/${result.id}`} className="block p-4 hover:bg-gray-700">
                      <h4 className="font-bold">{result.title}</h4>
                      <p className="text-sm text-gray-400 truncate">{result.description}</p>
                    </Link>
                  ) : (
                    <Link to={`/profile/${result.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-700">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.avatar_url} />
                        <AvatarFallback>{result.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-bold">{result.full_name}</h4>
                        <p className="text-sm text-gray-400">@{result.username}</p>
                      </div>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
