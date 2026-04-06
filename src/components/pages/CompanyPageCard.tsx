import { Link } from 'react-router-dom';
import { CompanyPage } from '@/types/companyPages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, CheckCircle2, Users, MapPin } from 'lucide-react';
import { useIsFollowingPage, useToggleFollowPage } from '@/hooks/useCompanyPages';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyPageCardProps {
  page: CompanyPage;
}

export function CompanyPageCard({ page }: CompanyPageCardProps) {
  const { user } = useAuth();
  const { data: isFollowing } = useIsFollowingPage(page.id);
  const toggleFollow = useToggleFollowPage();
  const isOwner = user?.id === page.owner_id;

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5">
      {/* Cover Image / Gradient */}
      <div className="h-24 relative">
        {page.cover_image_url ? (
          <img src={page.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-primary/20" />
        )}
        {/* Logo overlapping the cover */}
        <div className="absolute -bottom-8 left-4">
          <Avatar className="h-16 w-16 border-4 border-card shadow-lg">
            <AvatarImage src={page.logo_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              <Building2 className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 px-4 pb-4">
        <Link to={`/pages/${page.slug}`} className="block group/link">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-semibold text-base text-foreground group-hover/link:text-primary transition-colors truncate">
              {page.name}
            </h3>
            {page.is_verified && (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          {page.tagline && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{page.tagline}</p>
          )}
        </Link>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
          {page.headquarters && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {page.headquarters}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {page.follower_count.toLocaleString()} followers
          </span>
        </div>

        {/* Industries */}
        {page.industry.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {page.industry.slice(0, 2).map((ind, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0">
                {ind}
              </Badge>
            ))}
            {page.industry.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                +{page.industry.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Follow Button */}
        {!isOwner && (
          <Button
            variant={isFollowing ? 'outline' : 'default'}
            size="sm"
            className="w-full text-xs"
            onClick={(e) => {
              e.preventDefault();
              toggleFollow.mutate({ pageId: page.id, isFollowing: !!isFollowing });
            }}
            disabled={toggleFollow.isPending}
          >
            {isFollowing ? 'Following' : '+ Follow'}
          </Button>
        )}
        {isOwner && (
          <Button variant="outline" size="sm" className="w-full text-xs" asChild>
            <Link to={`/pages/${page.slug}`}>Manage Page</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
