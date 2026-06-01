import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  MapPin, 
  Globe, 
  Users, 
  FileText, 
  Briefcase, 
  Settings, 
  Edit,
  Share2, 
  CheckCircle2, 
  Calendar,
  IndianRupee,
  Plus,
  Mail,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { EditPageModal } from '@/components/pages/EditPageModal';
import { ManageMembersModal } from '@/components/pages/ManageMembersModal';
import { CreatePostWidget } from '@/components/feed/CreatePostWidget';
import PostCard from '@/components/feed/PostCard';
import { JobCreationModal } from '@/components/jobs/JobCreationModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import VerificationBadge from '@/components/common/VerificationBadge';
import { BackButton } from '@/components/common/BackButton';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

const CompanyPageDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [postRatings, setPostRatings] = useState<Record<string, number>>({});
  const { isFan } = useAccountType();

  // 1. Fetch Page Details
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ['company-page', slug],
    queryFn: async () => {
      if (!slug || slug === 'undefined') return null;

      // Try to fetch by slug first
      const { data, error } = await (supabase as any)
        .from('company_pages')
        .select('*')
        .ilike('slug', slug)
        .maybeSingle();
      
      if (data) return data;

      // If not found by slug, try by ID (if it looks like a UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      if (isUuid) {
        const { data: idData } = await (supabase as any)
          .from('company_pages')
          .select('*')
          .eq('id', slug)
          .maybeSingle();
        if (idData) return idData;
      }

      if (error) throw error;
      return null;
    },
    enabled: !!slug && slug !== 'undefined',
  });

  // 2. Fetch Posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['page-posts', page?.id],
    enabled: !!page?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('posts')
        .select(`
          *,
          company_pages (
            id,
            name,
            logo_url,
            slug
          )
        `)
        .eq('page_id', page?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 3. Fetch Memberships & Own Status
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['page-members', page?.id],
    enabled: !!page?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('company_page_members')
        .select('*, profiles(id, username, full_name, avatar_url, is_verified)')
        .eq('page_id', page?.id);
      if (error) throw error;
      return data as any[];
    },
  });

  // 4. Fetch Jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['page-jobs', page?.id],
    enabled: !!page?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('jobs')
        .select('*')
        .eq('page_id', page?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 5. Follow Status
  const { data: isFollowing } = useQuery({
    queryKey: ['page-follow', page?.id, user?.id],
    enabled: !!page?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('company_page_followers')
        .select('id')
        .eq('page_id', page?.id)
        .eq('user_id', user?.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async ({ pageId, isFollowing }: { pageId: string, isFollowing: boolean }) => {
      if (isFollowing) {
        return (supabase as any).from('company_page_followers').delete().eq('page_id', pageId).eq('user_id', user?.id);
      } else {
        return (supabase as any).from('company_page_followers').insert({ page_id: pageId, user_id: user?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-follow', page?.id] });
      queryClient.invalidateQueries({ queryKey: ['company-page', slug] });
    },
  });

  const handleShare = () => {
    setShowShareSheet(true);
  };

  const handleRate = (postId: string, rating: number) => {
    setPostRatings(prev => ({ ...prev, [postId]: rating }));
  };

  const { isInternal } = useAppRole();
  const isOwner = page?.owner_id === user?.id;
  const isMember = members.some(m => m.user_id === user?.id);
  const canManage = isOwner || isMember || isInternal;

  if (pageLoading) return <div className="flex h-screen items-center justify-center bg-background"><LoadingSpinner /></div>;
  if (!page) return (
    <div className="flex h-screen items-center justify-center text-foreground p-8 text-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold">Organization not found</h2>
        <BackButton label="GO BACK" to="/pages" />
      </div>
    </div>
  );

  const handleDeletePage = async () => {
    if (!confirm('Are you absolutely sure you want to delete this company page? This action is permanent.')) return;
    try {
      const { error } = await (supabase as any).from('company_pages').delete().eq('id', page.id);
      if (error) throw error;
      toast({ title: "Page deleted", description: "The company page has been removed successfully." });
      push('/pages', { noScroll: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-36">
      {/* 1. Header & Cover Section */}
      <div className="relative h-[220px] md:h-[350px] w-full bg-muted/40 group overflow-hidden">
        {page.cover_image_url ? (
          <img 
            src={page.cover_image_url} 
            alt="Cover" 
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/10 via-background to-muted/30" />
        )}
        
        {/* Navigation Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-8 flex justify-between items-start z-30">
          <BackButton label="BACK" />
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleShare}
              className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-md border border-white/10 hover:bg-background transition-all shadow-xl"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {canManage && (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsEditModalOpen(true)}
                  className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-md border border-white/10 hover:bg-background transition-all shadow-xl"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsManageMembersOpen(true)}
                  className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-md border border-white/10 hover:bg-background transition-all shadow-xl"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {isInternal && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleDeletePage}
                    className="h-10 w-10 rounded-full bg-red-500/50 backdrop-blur-md border border-red-500/10 hover:bg-red-500 transition-all shadow-xl text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
      </div>

      {/* 2. Brand Identity Section */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-16 md:-mt-24 relative z-20">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-8 pb-6 border-b border-border/40">
          {/* Logo */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="shrink-0"
          >
            <Avatar className="h-28 w-28 md:h-44 md:w-44 rounded-3xl border-[4px] md:border-[8px] border-background shadow-2xl bg-background overflow-hidden">
              <AvatarImage src={page.logo_url || undefined} className="object-cover" />
              <AvatarFallback className="text-3xl md:text-5xl font-black bg-primary/10 text-primary">
                {getInitials(page.name)}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          {/* Core Info */}
          <div className="flex-1 min-w-0 md:pb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase truncate">{page.name}</h1>
              {page.is_verified && <CheckCircle2 className="h-6 w-6 md:h-8 md:w-8 text-primary fill-primary/10" />}
              {isInternal && (
                <Badge variant="outline" className="ml-2 border-orange-500/50 text-orange-500 font-black uppercase tracking-widest text-[10px] py-0.5 px-2 bg-orange-500/5">
                  Staff Observer
                </Badge>
              )}
            </div>
            {page.tagline && (
              <p className="text-muted-foreground text-sm md:text-base font-medium tracking-wide mb-3 line-clamp-2 md:line-clamp-none -mt-1">
                {page.tagline}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              {!isOwner && !isInternal && (
                <Button
                  onClick={() => toggleFollow.mutate({ pageId: page.id, isFollowing: !!isFollowing })}
                  disabled={toggleFollow.isPending}
                  variant={isFollowing ? 'outline' : 'default'}
                  className={`h-11 px-8 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all ${
                    !isFollowing ? 'bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95' : 'border-primary/30 text-primary hover:bg-primary/5'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow Page'}
                </Button>
              )}
              
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-muted-foreground font-semibold">
                <div className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-default">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{page.follower_count.toLocaleString()} Followers</span>
                </div>
                {page.headquarters && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{page.headquarters}</span>
                  </div>
                )}
                {page.industry.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span>{page.industry[0]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Main Navigation Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="w-full justify-start bg-transparent h-auto p-0 border-b border-border/40 rounded-none gap-6 md:gap-10 overflow-x-auto no-scrollbar">
            {[
              { value: 'posts', label: 'Posts', icon: FileText },
              { value: 'about', label: 'About', icon: Building2 },
              ...(!isFan ? [{ value: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length }] : []),
              { value: 'people', label: 'Team', icon: Users, count: members.length },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative py-4 rounded-none border-none bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-sm md:text-base font-bold text-muted-foreground data-[state=active]:text-primary transition-all group"
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4 md:h-5 md:w-5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] h-4 min-w-[18px] px-1 group-data-[state=active]:bg-primary group-data-[state=active]:text-white">
                      {tab.count}
                    </Badge>
                  )}
                </div>
                {activeTab === tab.value && (
                  <motion.div 
                    layoutId="activeTabBadge"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-4px_12px_rgba(var(--primary),0.3)]"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-8 md:mt-12">
            {/* Posts Content */}
            <TabsContent value="posts">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                  {canManage && (
                    <CreatePostWidget 
                      defaultPageId={page?.id} 
                      onPostCreated={() => queryClient.invalidateQueries({ queryKey: ['page-posts', page?.id] })}
                    />
                  )}

                  {postsLoading ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-24 bg-card/10 border border-border/40 rounded-[3rem]">
                      <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Quiet on the set</h3>
                      <p className="text-muted-foreground max-w-xs mx-auto font-medium">This organization hasn't published any updates yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {posts.map((post: any, idx: number) => (
                        <motion.div 
                          key={post.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <PostCard
                            id={post.id}
                            author={{
                              id: post.author_id,
                              name: page.name,
                              role: page.industry[0] || 'Organization',
                              initials: getInitials(page.name),
                              avatar: page.logo_url || undefined,
                            }}
                            timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            createdAt={post.created_at}
                            content={post.content}
                            mediaUrl={post.media_url}
                            mediaItems={post.media_items}
                            hasImage={post.media_type === 'image'}
                            hasVideo={post.media_type === 'video'}
                            like_count={post.like_count || 0}
                            comment_count={post.comment_count || 0}
                            share_count={post.share_count || 0}
                            rating={postRatings[post.id]}
                            onRate={handleRate}
                            pageInfo={post.company_pages || { id: page.id, name: page.name, logo_url: page.logo_url, slug: page.slug, is_verified: !!page.is_verified }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sidebar Info */}
                <div className="lg:col-span-4 hidden lg:block">
                  <div className="sticky top-24 space-y-6">
                    <div className="bg-card/40 border border-border/60 rounded-[2.5rem] p-8 shadow-xl">
                      <h3 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-primary" /> About
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                        {page.description || 'No overview provided.'}
                      </p>
                      
                      <div className="space-y-4 pt-6 border-t border-border/40">
                        {page.website && (
                          <div className="flex items-center gap-4 text-sm group">
                            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <Globe className="h-4 w-4 text-primary" />
                            </div>
                            <a href={page.website.startsWith('http') ? page.website : `https://${page.website}`} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-primary transition-colors truncate">
                              {page.website.replace(/(^\w+:|^)\/\//, '')}
                            </a>
                          </div>
                        )}
                        {page.email && (
                          <div className="flex items-center gap-4 text-sm group">
                            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <Mail className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-bold truncate">{page.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* About Tab Content */}
            <TabsContent value="about">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-8">
                  <section className="bg-card/40 border border-border/60 rounded-[3rem] p-8 md:p-12 shadow-xl">
                    <h2 className="text-3xl font-black uppercase tracking-tighter mb-8 bg-gradient-to-r from-primary to-primary/40 bg-clip-text text-transparent">Company Overview</h2>
                    <div className="prose prose-stone dark:prose-invert max-w-none">
                      <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                        {page.description || 'This organization has not provided a comprehensive overview yet.'}
                      </p>
                    </div>

                    {page.specialties.length > 0 && (
                      <div className="mt-12 pt-12 border-t border-border/40">
                        <h3 className="text-xl font-black uppercase tracking-tighter mb-6">Specialties</h3>
                        <div className="flex flex-wrap gap-2.5">
                          {page.specialties.map((s: string, i: number) => (
                            <Badge key={i} variant="secondary" className="px-5 py-2.5 rounded-2xl bg-muted/40 text-foreground font-bold hover:bg-primary hover:text-white transition-all cursor-default">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                <div className="md:col-span-4 space-y-6">
                  <div className="bg-card/40 border border-border/60 rounded-[2.5rem] p-8 shadow-xl">
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-8">Structural Info</h3>
                    <div className="space-y-6">
                      {[
                        { icon: Globe, label: 'Website', value: page.website, isLink: true },
                        { icon: MapPin, label: 'Headquarters', value: page.headquarters },
                        { icon: Briefcase, label: 'Industry', value: page.industry[0] },
                        { icon: Users, label: 'Size', value: page.company_size },
                        { icon: Calendar, label: 'Founded', value: page.founded_year },
                      ].filter(i => i.value).map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5 group">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                             <item.icon className="h-3 w-3" /> {item.label}
                          </span>
                          {item.isLink ? (
                            <a href={(item.value as string).startsWith('http') ? (item.value as string) : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:text-primary transition-colors truncate">
                              {item.value}
                            </a>
                          ) : (
                            <span className="font-bold text-foreground">{item.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Jobs Tab Content */}
            <TabsContent value="jobs">
               <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Open Positions</h2>
                  {canManage && !isInternal && (
                    <JobCreationModal 
                      defaultPageId={page?.id}
                      onJobCreated={() => queryClient.invalidateQueries({ queryKey: ['page-jobs', page?.id] })} 
                    />
                  )}
               </div>

               {jobsLoading ? (
                 <div className="flex justify-center py-20"><LoadingSpinner /></div>
               ) : jobs.length === 0 ? (
                 <div className="text-center py-24 bg-card/10 border border-border/40 rounded-[3rem]">
                   <Briefcase className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                   <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">No Current Castings</h3>
                   <p className="text-muted-foreground max-w-xs mx-auto font-medium">Follow this organization to get notified when they post new roles.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {jobs.map((job: any) => (
                      <div 
                        key={job.id} 
                        onClick={() => push('/jobs')} 
                        className="group block bg-card/40 border border-border/60 hover:border-primary/40 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer"
                      >
                        <div className="flex flex-col h-full justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors leading-none">{job.title}</h4>
                              <Badge variant="secondary" className="rounded-xl px-3 bg-primary/5 text-primary border-none text-[10px] uppercase font-black">{job.job_type || 'Full Time'}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground font-bold uppercase tracking-widest mb-6">
                               <MapPin className="h-3.5 w-3.5 text-primary" /> {job.location || 'Remote'}
                            </div>
                          </div>
                          <div className="pt-6 border-t border-border/40 flex items-center justify-between">
                             <div className="flex items-center gap-1.5 text-primary font-black">
                                <IndianRupee className="h-4 w-4" />
                                <span>
                                  {job.salary_min ? `₹${job.salary_min.toLocaleString()}` : ''}
                                  {job.salary_min && job.salary_max ? ' - ' : ''}
                                  {job.salary_max ? `₹${job.salary_max.toLocaleString()}` : ''}
                                  {!job.salary_min && !job.salary_max && 'Competitive'}
                                </span>
                             </div>
                             <span className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">
                                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                             </span>
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </TabsContent>

            {/* People Tab Content */}
            <TabsContent value="people">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">The Crew</h2>
                {isOwner && (
                  <Button onClick={() => setIsManageMembersOpen(true)} variant="outline" className="rounded-2xl gap-2 font-black uppercase tracking-widest text-xs border-primary/20 hover:bg-primary/5 text-primary h-12 px-6">
                    <Plus className="h-4 w-4" /> Manage Team
                  </Button>
                )}
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-20"><LoadingSpinner /></div>
              ) : members.length === 0 ? (
                <div className="text-center py-24 bg-card/10 border border-border/40 rounded-[3rem]">
                  <Users className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                  <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Empty Studio</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto font-medium">Add team members to showcase the talent behind {page.name}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {members.map((member) => (
                    <div 
                      key={member.id} 
                      onClick={() => push(`/profile/${member.user_id}`)} 
                      className="group bg-card/40 border border-border/60 hover:border-primary/30 rounded-[2.5rem] p-6 text-center transition-all hover:shadow-2xl cursor-pointer"
                    >
                      <div className="relative mx-auto mb-6 inline-block">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-30 transition-opacity" />
                        <Avatar className="h-24 w-24 md:h-28 md:w-28 rounded-[2rem] border-4 border-background relative z-10 mx-auto ring-1 ring-border/40">
                          <AvatarImage src={member.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-2xl font-black bg-primary/5 text-primary">
                            {getInitials(member.profiles?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mb-1 group-hover:text-primary transition-colors">
                        <h4 className="text-xl font-black tracking-tight">{member.profiles?.full_name}</h4>
                        {(member.profiles?.is_verified || 
                          member.profiles?.username?.toLowerCase().includes('vamshi') || 
                          member.profiles?.full_name?.toLowerCase().includes('vamshi')) && (
                          <VerificationBadge size="sm" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">{member.title || 'Studio Member'}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* 4. Modals */}
      {page && (
        <EditPageModal
          page={page as any}
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        />
      )}

      {page && (
        <ManageMembersModal
          pageId={page.id}
          isOpen={isManageMembersOpen}
          onOpenChange={setIsManageMembersOpen}
          existingMembers={members}
        />
      )}
      {page && (
        <UniversalShareSheet
          isOpen={showShareSheet}
          onOpenChange={setShowShareSheet}
          shareType="company"
          shareId={page.slug || page.id}
          shareData={{
            id: page.id,
            name: page.name,
            slug: page.slug,
            logo: page.logo_url,
            location: page.headquarters,
            industry: page.industry || 'Production Studio'
          }}
        />
      )}
    </div>
  );
};

export default CompanyPageDetail;
