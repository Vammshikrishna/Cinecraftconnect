
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Globe, MapPin, Briefcase } from 'lucide-react';

export const AccountSettings = () => {
  const { user } = useAuth();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center">
          <User className="mr-2 h-5 w-5" />
          Account Settings
        </CardTitle>
        <CardDescription>
          Manage your account security and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="flex items-center">
            <Mail className="mr-1 h-4 w-4" />
            Email Address
          </Label>
          <Input
            value={user?.email || ''}
            disabled
            className="bg-muted border-border text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Email cannot be changed. Contact support if you need to update it.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">Password</h3>
          <Button variant="outline" size="sm" className="border-border">
            Change Password
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" size="sm">
            Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
