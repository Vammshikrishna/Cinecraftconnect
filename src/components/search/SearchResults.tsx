import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Users, Activity, Layers, Play, Grid3x3, ChevronLeft, ChevronRight, Share2, ArrowRight } from 'lucide-react';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import CommentSection from '@/components/feed/CommentSection';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';

interface SearchResultsProps {
  query: string;
  filters: any;
}

type ResultItem = {
  id: string;
  type: 'post' | 'project' | 'discussion';
  title?: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  media_items?: any[];
  like_count?: number;
  comment_count?: number;
  created_at: string;
  profiles?: any;
  author_id?: string;
  creator_id?: string;
  name?: string;
  description?: string;
  member_count?: number;
  tags?: string[];
};
const SearchResults = ({ query, filters }: SearchResultsProps) => {
  const { push } = useAppNavigation();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ResultItem | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const fetchResults = async () => {
    // Discovery Mode: If no query, fetch most recent media posts (Trending)
    const isDiscovery = !query && !filters.mediaOnly && !filters.contentType?.length;
    
    setLocalLoading(true);
    try {
      // 1. Posts Query (Discovery: Only Media, Search: All)
      let postsQuery = supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            id,
            full_name,
            username,
            avatar_url,
            craft
          )
        `);

      if (query) {
        postsQuery = postsQuery.ilike('content', `%${query}%`);
      } else if (isDiscovery) {
        // Trending discovery showing only media posts
        postsQuery = postsQuery.not('media_url', 'is', null);
      }
      
      if (filters.mediaOnly) {
        postsQuery = postsQuery.not('media_url', 'is', null);
      }

      postsQuery = postsQuery.order('created_at', { ascending: false });

      // 2. Projects Query
      let projectsQuery = supabase
        .from('projects')
        .select(`
          *,
          profiles:creator_id (
            id,
            full_name,
            username,
            avatar_url
          )
        `);
      
      if (query) {
        projectsQuery = projectsQuery.ilike('title', `%${query}%`);
      }

      // 3. Discussion Rooms Query
      let discussionsQuery = supabase
        .from('discussion_rooms')
        .select(`
          *,
          room_categories (name)
        `);

      if (query) {
        discussionsQuery = discussionsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const [
        { data: posts, error: pErr },
        { data: projects, error: prErr },
        { data: discussions, error: dErr }
      ] = await Promise.all([
        postsQuery.limit(query ? 24 : 12),
        projectsQuery.limit(query ? 10 : 0), // No projects in basic discovery
        discussionsQuery.limit(query ? 10 : 0) // No discussions in basic discovery
      ]);

      if (pErr) console.error(pErr);
      if (prErr) console.error(prErr);
      if (dErr) console.error(dErr);

      const mapped: ResultItem[] = [
        ...(posts || []).map((p: any) => ({ ...p, type: 'post' as const })),
        ...(projects || []).map((p: any) => ({ ...p, type: 'project' as const })),
        ...(discussions || []).map((p: any) => ({ ...p, type: 'discussion' as const }))
      ];

      setResults(mapped);
    } catch (err) {
      console.error('Search mapping error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();

    // Set up real-time subscriptions
    const postsChannel = supabase.channel('search-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchResults())
      .subscribe();
      
    const projectsChannel = supabase.channel('search-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchResults())
      .subscribe();

    const discussionsChannel = supabase.channel('search-discussions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_rooms' }, () => fetchResults())
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(discussionsChannel);
    };
  }, [query, JSON.stringify(filters)]);

  const posts = results.filter((r: ResultItem) => r.type === 'post');
  const projects = results.filter((r: ResultItem) => r.type === 'project');
  const discussions = results.filter((r: ResultItem) => r.type === 'discussion');

  if (localLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-[2px] pb-20">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i: number) => (
          <div key={i} className="aspect-[4/5] md:aspect-[3/4] lg:aspect-[4/5] bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
        <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
        <h3 className="text-xl font-bold mb-2">No results matching your discovery</h3>
        <p className="text-muted-foreground">Try exploring different terms or tags</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-fade-in custom-scrollbar">
      {/* 1. Projects & Discussions Section */}
      {(projects.length > 0 || discussions.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project: any) => (
            <Card key={project.id} className="group glass-card hover:bg-white/5 transition-all overflow-hidden border-white/5 cursor-pointer" onClick={() => push(`/projects/${project.id}/space`)}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-400 border-blue-500/20 px-2 py-0">Project</Badge>
                  <span className="text-[10px] text-muted-foreground opacity-60">• {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                </div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold tracking-tight line-clamp-1 group-hover:text-primary transition-colors">{project.title}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{project.description || 'No description provided.'}</p>
                <div className="flex items-center justify-between">
                  {project.profiles && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 ring-1 ring-white/10">
                        <AvatarImage src={project.profiles.avatar_url} />
                        <AvatarFallback>{project.profiles.username?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold">{project.profiles.username}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Enter Space
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {discussions.map((room: any) => (
            <Card key={room.id} className="group glass-card hover:bg-white/5 transition-all overflow-hidden border-white/5 cursor-pointer" onClick={() => push(`/discussion-rooms/${room.id}`)}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-primary/10 text-green-400 border-primary/20 px-2 py-0">Live Discussion</Badge>
                  <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold animate-pulse">
                    <Activity className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold tracking-tight line-clamp-1 group-hover:text-primary transition-colors">{room.title || room.name}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{room.description || 'Join the conversation.'}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-bold">{room.member_count || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Join Conversation
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 2. Posts Grid (Instagram Style) */}
      {posts.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <Grid3x3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black uppercase tracking-widest">Discover Feed</h2>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-4 gap-[2px]">
            {posts.map((post: any) => {
              const items = post.media_items || (post.media_url ? [{ url: post.media_url, type: post.media_type as 'image'|'video' }] : []);
              const currentItem = items[0];
              const hasMedia = items.length > 0;
              const isVideo = currentItem?.type === 'video';
              const isMulti = items.length > 1;

              return (
                <div
                  key={post.id}
                  onClick={() => { setSelectedPost(post); setCurrentMediaIndex(0); }}
                  className="group relative aspect-[4/5] md:aspect-[3/4] lg:aspect-[4/5] bg-muted overflow-hidden cursor-pointer transition-all hover:brightness-110 active:scale-95"
                >
                  {hasMedia ? (
                    isVideo ? (
                      <video src={currentItem.url} className="w-full h-full object-cover" />
                    ) : (
                      <img
                        src={currentItem.url}
                        alt="Post"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-card to-muted/5 group-hover:brightness-110 transition-all duration-500">
                      {post.content.includes('JOB_SHARE::') ? (
                        (() => {
                          try {
                            const parts = post.content.split('JOB_SHARE::');
                            const jsonStr = parts[parts.length - 1].trim();
                            const shareData = JSON.parse(jsonStr);

                            return (
                              <div className="w-full h-full p-2.5 flex flex-col justify-between items-center text-center">
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl border-4 border-background shadow-xl ring-1 ring-white/10 bg-background overflow-hidden shrink-0 mt-2">
                                  <Avatar className="h-full w-full rounded-none">
                                    <AvatarImage src={shareData.logoUrl || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">
                                      {shareData.company?.[0]?.toUpperCase() || 'J'}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="flex-1 w-full flex flex-col justify-center items-center gap-1.5 px-1 pb-2">
                                  <h4 className="text-[10px] md:text-xs font-black text-foreground leading-tight tracking-tighter uppercase truncate w-full max-w-[100px]">
                                    {shareData.title || 'Opening'}
                                  </h4>
                                  <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[6px] md:text-[8px] font-black text-primary uppercase tracking-widest shrink-0">
                                    Hiring
                                  </div>
                                </div>
                              </div>
                            );
                          } catch (e) {
                            return (
                              <div className="w-full h-full p-3 md:p-4 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-center">
                                <p className="text-xs md:text-sm text-foreground line-clamp-6 font-medium">
                                  {post.content.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim()}
                                </p>
                              </div>
                            );
                          }
                        })()
                      ) : (
                        <div className="w-full h-full p-4 md:p-6 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-muted/10 group-hover:brightness-125 transition-all duration-700">
                          {/* Subtle Internal Lighting */}
                          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

                          <p className="text-sm md:text-base font-black tracking-tight text-foreground leading-[1.2] text-center line-clamp-5 drop-shadow-sm uppercase">
                            {post.content.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim()}
                          </p>

                          {/* Quote Marker Decor */}
                          <div className="absolute bottom-2 right-3 opacity-10 font-black text-4xl leading-none">"</div>
                        </div>
                      )}
                      {/* Subtle Card Border Effect */}
                      <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-none md:rounded-sm" />
                    </div>
                  )}

                  {/* Indicators */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10 text-white drop-shadow-lg">
                    {isMulti && <Layers className="w-4 h-4 md:w-5 md:h-5" />}
                    {isVideo && !isMulti && <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 text-white">
                      <Heart className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                      <span className="font-bold text-sm md:text-base">{post.like_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <MessageCircle className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                      <span className="font-bold text-sm md:text-base">{post.comment_count || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Post Viewer Fragment (Matching UserPosts/PostCard) */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-7xl w-full h-full lg:w-[95vw] lg:h-[95vh] p-0 gap-0 bg-black border-none overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Discover Post</DialogTitle>
            <DialogDescription>Viewing search result post in full view</DialogDescription>
          </VisuallyHidden>

          {(() => {
            if (!selectedPost) return null;
            const items = selectedPost.media_items || (selectedPost.media_url ? [{ url: selectedPost.media_url, type: selectedPost.media_type as 'image'|'video' }] : []);
            const currentItem = items[currentMediaIndex];
            const hasMultiple = items.length > 1;

            return (
              <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden p-4 border-b border-border/10 bg-background flex items-center justify-between z-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 ring-1 ring-primary/20">
                      <AvatarImage src={selectedPost.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {selectedPost.profiles?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{selectedPost.profiles?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground italic -mt-0.5 opacity-80">{selectedPost.profiles?.craft || 'Artist'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-black flex items-center justify-center relative min-h-0 group/gallery order-1 lg:order-none overflow-hidden">
                  {hasMultiple && (
                    <>
                      <Button
                        variant="ghost" size="icon"
                        className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full h-10 w-10 lg:h-12 lg:w-12 backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex((prev: number) => (prev - 1 + items.length) % items.length); }}
                      >
                        <ChevronLeft className="h-6 w-6 lg:h-8 lg:w-8" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-50 text-white bg-black/30 hover:bg-black/50 rounded-full h-10 w-10 lg:h-12 lg:w-12 backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex((prev: number) => (prev + 1) % items.length); }}
                      >
                        <ChevronRight className="h-6 w-6 lg:h-8 lg:w-8" />
                      </Button>
                    </>
                  )}

                  <div className="h-full w-full flex items-center justify-center p-0 lg:p-4">
                    {currentItem?.type === 'video' ? (
                      <video src={currentItem.url} controls autoPlay playsInline className="w-full h-full lg:max-h-full lg:max-w-full object-contain" />
                    ) : (
                      <img src={currentItem?.url} className="w-full h-full lg:max-h-full lg:max-w-full object-contain shadow-2xl" />
                    )}
                  </div>
                </div>

                {/* Right Side Panel */}
                <div className="w-full lg:w-[420px] flex flex-col bg-card border-l border-border/10 shrink-0 h-fit max-h-[45vh] lg:h-full lg:max-h-none overflow-hidden z-10">
                  <div className="hidden lg:flex p-5 border-b border-border/10 items-center justify-between bg-background/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3 font-outfit">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                        <AvatarImage src={selectedPost.profiles?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{selectedPost.profiles?.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{selectedPost.profiles?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black opacity-80">{selectedPost.profiles?.craft || 'Artist'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 lg:p-5 border-b border-border/10 bg-background/50 backdrop-blur-2xl space-y-4">
                    <div className="flex items-center gap-6">
                      <Heart className="h-7 w-7 text-primary cursor-pointer hover:scale-110 transition-transform" />
                      <MessageCircle className="h-7 w-7 text-primary cursor-pointer hover:scale-110 transition-transform" />
                      <Share2 className="h-7 w-7 text-primary cursor-pointer hover:scale-110 transition-transform" onClick={() => setShowShareSheet(true)} />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-background/30">
                    <p className="text-[14px] leading-relaxed mb-6 bg-primary/5 p-4 rounded-xl border border-primary/5">
                      <span className="font-black text-primary mr-1.5">{selectedPost.profiles?.username}</span>
                      {selectedPost.content}
                    </p>
                    <CommentSection postId={selectedPost.id} />
                  </div>

                  <div className="p-3 border-t border-border/10 bg-background/90 text-center opacity-80">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.4em] font-black">
                      PUBLISHED {selectedPost.created_at ? new Date(selectedPost.created_at).toLocaleDateString() : 'RECENTLY'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {selectedPost && (
        <UniversalShareSheet
          isOpen={showShareSheet}
          onOpenChange={setShowShareSheet}
          shareType="post"
          shareId={selectedPost.id}
          shareData={{
            postId: selectedPost.id,
            previewUrl: selectedPost.media_items?.[0]?.url || selectedPost.media_url,
            caption: selectedPost.content,
            author: {
              username: selectedPost.profiles.username,
              avatar_url: selectedPost.profiles.avatar_url,
              is_verified: selectedPost.profiles.is_verified
            }
          }}
        />
      )}
    </div>
  );
};

export default SearchResults;
