import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { 
  Film, 
  User, 
  Users, 
  MapPin, 
  DollarSign, 
  Calendar,
  ExternalLink,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'project' | 'person' | 'collaboration';
  title?: string;
  full_name?: string;
  description?: string;
  bio?: string;
  location?: string;
  craft?: string;
  genre?: string[];
  required_roles?: string[];
  budget_min?: number;
  budget_max?: number;
  status?: string;
  created_at?: string;
  posted_date?: string;
  avatar_url?: string;
  profiles?: any;
}

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

export const SearchResults = ({ results, isLoading }: SearchResultsProps) => {
  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Budget TBD';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'project': return <Film className="h-4 w-4" />;
      case 'person': return <User className="h-4 w-4" />;
      case 'collaboration': return <Users className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getResultColor = (type: string) => {
    switch (type) {
      case 'project': return 'bg-blue-500';
      case 'person': return 'bg-green-500';
      case 'collaboration': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getResultLink = (result: SearchResult) => {
    switch (result.type) {
      case 'project': return `/projects/${result.id}`;
      case 'person': return `/profile/${result.id}`;
      case 'collaboration': return `/collaborations/${result.id}`;
      default: return '#';
    }
  };

  if (isLoading) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Searching...</CardTitle>
          <CardDescription>Finding relevant results for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex space-x-3">
                  <div className="h-10 w-10 bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-700 rounded w-full"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Search Results
          </span>
          {results.length > 0 && (
            <Badge variant="secondary">
              {results.length} result{results.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        {results.length > 0 && (
          <CardDescription>
            Found {results.length} result{results.length > 1 ? 's' : ''} matching your criteria
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={`${result.type}-${result.id}`}>
                <div className="p-4 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
                  <div className="flex items-start space-x-3">
                    {/* Type Icon */}
                    <div className={`p-2 rounded-full ${getResultColor(result.type)}`}>
                      {getResultIcon(result.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white text-lg">
                            {result.title || result.full_name}
                          </h4>
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {result.type}
                            </Badge>
                            {result.craft && (
                              <Badge variant="secondary" className="text-xs">
                                {result.craft}
                              </Badge>
                            )}
                            {result.status && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {result.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={getResultLink(result)}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>

                      {/* Description */}
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {result.description || result.bio}
                      </p>

                      {/* Metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-xs">
                        {result.location && (
                          <div className="flex items-center text-gray-300">
                            <MapPin className="mr-1 h-3 w-3" />
                            <span>{result.location}</span>
                          </div>
                        )}
                        
                        {(result.budget_min || result.budget_max) && (
                          <div className="flex items-center text-gray-300">
                            <DollarSign className="mr-1 h-3 w-3" />
                            <span>{formatBudget(result.budget_min, result.budget_max)}</span>
                          </div>
                        )}

                        {(result.created_at || result.posted_date) && (
                          <div className="flex items-center text-gray-300">
                            <Calendar className="mr-1 h-3 w-3" />
                            <span>
                              {formatDistanceToNow(
                                new Date(result.created_at || result.posted_date!), 
                                { addSuffix: true }
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {result.genre?.slice(0, 3).map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                        {result.required_roles?.slice(0, 3).map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>

                      {/* Creator Info for Projects/Collaborations */}
                      {(result.type === 'project' || result.type === 'collaboration') && result.profiles && (
                        <div className="flex items-center mt-3 pt-3 border-t border-white/10">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={result.profiles.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {result.profiles.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-400">
                            by {result.profiles.full_name || 'Unknown'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {index < results.length - 1 && <Separator className="my-2 bg-white/10" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-400 text-lg mb-2">No results found</p>
            <p className="text-gray-500">
              Try adjusting your search terms or filters to find what you're looking for
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};