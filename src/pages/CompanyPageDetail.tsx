import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useCompanyPage,
  useIsFollowingPage,
  useToggleFollowPage,
  usePagePosts,
  usePageJobs,
  usePageMembers,
  useIsPageAdmin,
} from '@/hooks/useCompanyPages';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EditPageModal } from '@/components/pages/EditPageModal';
import { ManageMembersModal } from '@/components/pages/ManageMembersModal';
import { CreatePostWidget } from '@/components/feed/CreatePostWidget';
import { JobCreationModal } from '@/components/jobs/JobCreationModal';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import PostCard from '@/components/feed/PostCard';
import {
  Building2,
  CheckCircle2,
  Users,
  MapPin,
  Globe,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  FileText,
  ArrowLeft,
  Share2,
  ExternalLink,
  Clock,
  IndianRupee,
  Settings,
  UserPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CompanyPageDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [postRatings, setPostRatings] = useState<{ [key: string]: number }>({});

  const { data: page, isLoading } = useCompanyPage(slug);
  const { data: isFollowing } = useIsFollowingPage(page?.id);
  const { data: _isAdmin } = useIsPageAdmin(page?.id);
  const toggleFollow = useToggleFollowPage();
  const { data: posts = [], isLoading: postsLoading } = usePagePosts(page?.id);
  const { data: jobs = [], isLoading: jobsLoading } = usePageJobs(page?.id);
  const { data: members = [], isLoading: membersLoading } = usePageMembers(page?.id);
  const queryClient = useQueryClient();

  // Force refetch when follow status changes to ensure total accuracy
  useEffect(() => {
    if (page?.id) {
      queryClient.invalidateQueries({ queryKey: ['company-page', slug] });
    }
  }, [isFollowing, page?.id, queryClient, slug]);

  const isOwner = user?.id === page?.owner_id;
  const canManage = isOwner || _isAdmin;

  const handleRate = (postId: string, rating: number) => {
    setPostRatings(prev => ({ ...prev, [postId]: rating }));
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/pages/${page?.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: page?.name, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Copied', description: 'Page link copied to clipboard' });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground mb-4">This page doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/pages')}>Browse Pages</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-primary/20 via-primary/5 to-background">
        {page.cover_image_url && (
          <img src={page.cover_image_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-20 left-4 md:left-8 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Page Header */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
          {/* Logo */}
          <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-card shadow-xl rounded-xl">
            <AvatarImage src={page.logo_url || undefined} className="rounded-xl" />
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-3xl font-bold">
              <Building2 className="h-12 w-12" />
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 pt-2">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{page.name}</h1>
                  {page.is_verified && <CheckCircle2 className="h-6 w-6 text-primary" />}
                </div>
                {page.tagline && (
                  <p className="text-muted-foreground text-base md:text-lg mb-2">{page.tagline}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {page.headquarters && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {page.headquarters}
                    </span>
                  )}
                  {page.industry.length > 0 && (
                    <span className="flex items-center gap-1">{page.industry[0]}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {page.follower_count.toLocaleString()} followers
                  </span>
                  {page.company_size && (
                    <span className="flex items-center gap-1">{page.company_size} employees</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isOwner && (
                  <Button
                    onClick={() => toggleFollow.mutate({ pageId: page.id, isFollowing: !!isFollowing })}
                    disabled={toggleFollow.isPending}
                    variant={isFollowing ? 'outline' : 'default'}
                    className={`gap-2 ${!isFollowing ? 'shadow-lg shadow-primary/20' : ''}`}
                  >
                    {isFollowing ? 'Following' : '+ Follow'}
                  </Button>
                )}
                
                {(isOwner || _isAdmin) && (
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                    Edit Page
                  </Button>
                )}

                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
            {[
              { value: 'posts', label: 'Posts', icon: FileText },
              { value: 'about', label: 'About', icon: Building2 },
              { value: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length },
              { value: 'people', label: 'People', icon: Users, count: members.length },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 gap-2 text-sm"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-6">
            {canManage && (
              <div className="mb-6">
                <CreatePostWidget 
                  defaultPageId={page?.id} 
                  onPostCreated={() => queryClient.invalidateQueries({ queryKey: ['page-posts', page?.id] })}
                />
              </div>
            )}
            
            {postsLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No posts yet</h3>
                <p className="text-muted-foreground text-sm">
                  {canManage ? 'Start sharing updates from your page!' : 'This page hasn\'t published any posts yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {posts.map((post: any) => {
                  const authorName = page.name; // Post shows as from the page
                  return (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      author={{
                        id: post.author_id,
                        name: authorName,
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
                      pageInfo={post.company_pages || { id: page.id, name: page.name, logo_url: page.logo_url, slug: page.slug }}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left: Description & Specialties */}
              <div className="md:col-span-2 space-y-6">
                {page.description && (
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="font-semibold text-lg mb-3">Overview</h3>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {page.description}
                    </p>
                  </div>
                )}

                {page.specialties.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="font-semibold text-lg mb-3">Specialties</h3>
                    <div className="flex flex-wrap gap-2">
                      {page.specialties.map((s, i) => (
                        <Badge key={i} variant="secondary" className="px-3 py-1">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Quick Info Card */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Details</h3>

                  {page.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="h-4 w-4 text-primary flex-shrink-0" />
                      <a
                        href={page.website.startsWith('http') ? page.website : `https://${page.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate flex items-center gap-1"
                      >
                        {page.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {page.headquarters && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{page.headquarters}</span>
                    </div>
                  )}

                  {page.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                      <a href={`mailto:${page.email}`} className="text-muted-foreground hover:text-primary transition-colors">
                        {page.email}
                      </a>
                    </div>
                  )}

                  {page.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{page.phone}</span>
                    </div>
                  )}

                  {page.company_size && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{page.company_size} employees</span>
                    </div>
                  )}

                  {page.founded_year && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">Founded {page.founded_year}</span>
                    </div>
                  )}

                  {page.industry.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Industry</p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.industry.map((ind, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{ind}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="mt-6">
            {canManage && (
              <div className="flex justify-end mb-4">
                <JobCreationModal 
                  defaultPageId={page?.id}
                  onJobCreated={() => queryClient.invalidateQueries({ queryKey: ['page-jobs', page?.id] })} 
                />
              </div>
            )}

            {jobsLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No open positions</h3>
                <p className="text-muted-foreground text-sm">
                  {canManage ? 'Post jobs to find talent!' : 'This organization has no open positions right now.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {jobs.map((job: any) => (
                  <Link
                    key={job.id}
                    to="/jobs"
                    className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {job.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{page.name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {job.location}
                            </span>
                          )}
                          {job.job_type && (
                            <Badge variant="secondary" className="text-[10px]">{job.job_type}</Badge>
                          )}
                          {job.salary_range && (
                            <span className="flex items-center gap-1">
                              <IndianRupee className="h-3 w-3" /> {job.salary_range}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* People Tab */}
          <TabsContent value="people" className="mt-6">
            {isOwner && (
              <div className="flex justify-end mb-4">
                <Button onClick={() => setIsManageMembersOpen(true)} variant="outline" size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" /> Manage Members
                </Button>
              </div>
            )}
            
            {membersLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : members.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No team members listed</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {isOwner ? 'Add team members to showcase your team!' : 'Team members will appear here when added.'}
                </p>
                {isOwner && (
                  <Button onClick={() => setIsManageMembersOpen(true)}>Add Team Members</Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Link
                    key={member.id}
                    to={`/profile/${member.user_id}`}
                    className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all flex items-center gap-4 group"
                  >
                    <Avatar className="h-14 w-14 border border-border">
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-sm">
                        {getInitials(member.profiles?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {member.profiles?.full_name || 'Unknown'}
                      </h4>
                      {member.title && (
                        <p className="text-xs text-muted-foreground truncate">{member.title}</p>
                      )}
                      {member.department && (
                        <Badge variant="secondary" className="text-[10px] mt-1">{member.department}</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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
    </div>
  );
};

export default CompanyPageDetail;
