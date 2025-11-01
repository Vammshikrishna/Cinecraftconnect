import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  Film,
  MessageCircle,
  Send,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  genre: string[];
  required_roles: string[];
  budget_min: number;
  budget_max: number;
  start_date: string;
  end_date?: string;
  creator_id: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    craft?: string;
  } | null;
}

interface ProjectDetailDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailDialog({ project, open, onOpenChange }: ProjectDetailDialogProps) {
  const navigate = useNavigate();
  
  if (!project) return null;

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Budget TBD';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planning': return 'secondary';
      case 'in-production': return 'default';
      case 'post-production': return 'outline';
      case 'completed': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{project.title}</DialogTitle>
              <Badge variant={getStatusVariant(project.status)} className="capitalize">
                {project.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Creator Info */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Avatar>
              <AvatarImage src={project.profiles?.avatar_url} />
              <AvatarFallback>
                {project.profiles?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{project.profiles?.full_name || 'Unknown'}</p>
              {project.profiles?.craft && (
                <p className="text-sm text-muted-foreground">{project.profiles.craft}</p>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Posted {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">About This Project</h3>
            <p className="text-muted-foreground leading-relaxed">{project.description}</p>
          </div>

          <Separator />

          {/* Project Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Location:</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {project.location || 'Not specified'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Budget:</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {formatBudget(project.budget_min, project.budget_max)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Start Date:</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {project.start_date 
                  ? new Date(project.start_date).toLocaleDateString()
                  : 'TBD'}
              </p>
            </div>

            {project.end_date && (
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">End Date:</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {new Date(project.end_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Genres */}
          {project.genre && project.genre.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                <Film className="mr-2 h-4 w-4" />
                Genres
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.genre.map((g) => (
                  <Badge key={g} variant="secondary">
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Required Roles */}
          {project.required_roles && project.required_roles.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Looking For
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.required_roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                navigate(`/projects/${project.id}/discussion`);
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Go to Discussion Room
            </Button>
            <Button variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Express Interest
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
