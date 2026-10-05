
import { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import { Profile } from '@/types';

interface ProfileDisplayProps {
  profile: Profile;
}

const ProfileDisplay: FC<ProfileDisplayProps> = ({ profile }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About Me</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {profile.bio || 'This user hasn\'t written anything about themselves yet.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Craft</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {profile.craft || 'No craft has been added yet.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              <Globe className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          )}
          {!profile.website && (
            <p className="text-muted-foreground">No social links have been added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileDisplay;
