import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

// Basic type definitions for search results
interface ProjectResult {
    id: string;
    name: string;
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

const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const [projectsRes, usersRes] = await Promise.all([
                supabase.from('project_spaces').select('id, name, description').textSearch('name', searchQuery, { type: 'websearch' }),
                supabase.from('profiles').select('id, username, full_name, avatar_url').textSearch('username', searchQuery, { type: 'websearch' })
            ]);

            const projects = (projectsRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                type: 'project' as const
            }));

            const users = (usersRes.data || []).map(u => ({
                id: u.id,
                username: u.username || '',
                full_name: u.full_name || '',
                avatar_url: u.avatar_url || '',
                type: 'user' as const
            }));

            setResults([...projects, ...users]);
        } catch (error) {
            console.error('Error during search:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialQuery) {
            performSearch(initialQuery);
        }
    }, [initialQuery, performSearch]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        setSearchParams(newQuery ? { q: newQuery } : {});
        performSearch(newQuery);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-2xl font-bold">Search</h1>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <Input
                        type="search"
                        placeholder="Search for projects, people..."
                        className="pl-12 pr-4 py-6 text-lg w-full bg-card border-border rounded-xl focus:ring-2 focus:ring-primary/50 transition-all"
                        value={query}
                        onChange={handleSearch}
                        autoFocus
                    />
                </div>

                <div className="space-y-4">
                    {loading && <div className="text-center py-8 text-muted-foreground">Searching...</div>}

                    {!loading && query.length > 1 && results.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No results found for "{query}"</div>
                    )}

                    {!loading && results.length > 0 && (
                        <div className="grid gap-4">
                            {results.map(result => (
                                <div key={`${result.type}-${result.id}`} className="glass-card p-4 rounded-xl hover:bg-accent/5 transition-colors">
                                    {result.type === 'project' ? (
                                        <Link to={`/projects/${result.id}`} className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <Search size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.name}</h3>
                                                    <p className="text-muted-foreground line-clamp-2">{result.description}</p>
                                                    <span className="inline-block mt-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Project</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ) : (
                                        <Link to={`/profile/${result.id}`} className="block">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={result.avatar_url} />
                                                    <AvatarFallback>{result.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.full_name || result.username}</h3>
                                                    <p className="text-muted-foreground">@{result.username}</p>
                                                    <span className="inline-block mt-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">User</span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
