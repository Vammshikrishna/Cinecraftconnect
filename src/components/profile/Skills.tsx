import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/database.types';

type Skill = Tables<'user_skills'>;

const Skills = ({ userId, isOwner }: { userId: string, isOwner: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_skills')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setSkills(data || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching skills',
        description: error.message || 'Could not load skills.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleAddSkill = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim() || !user) return;

    const skillName = newSkill.trim();
    
    if (skills.some(skill => skill.skill_name.toLowerCase() === skillName.toLowerCase())) {
      toast({
        title: 'Duplicate Skill',
        description: 'You have already added this skill.',
        variant: 'default',
      });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('user_skills')
      .insert({ user_id: user.id, skill_name: skillName })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Error adding skill',
        description: error.message || 'Could not add the new skill.',
        variant: 'destructive',
      });
    } else if (data) {
      setSkills(prevSkills => [...prevSkills, data]);
      setNewSkill('');
      toast({
        title: 'Skill Added',
        description: `"${skillName}" has been added to your profile.`,
      });
    }
    setIsSubmitting(false);
  };

  const handleDeleteSkill = async (skillId: number, skillName: string) => {
    const originalSkills = skills;
    setSkills(prevSkills => prevSkills.filter(s => s.id !== skillId));

    const { error } = await supabase
      .from('user_skills')
      .delete()
      .eq('id', skillId);

    if (error) {
      setSkills(originalSkills); // Revert on error
      toast({
        title: 'Error deleting skill',
        description: error.message || 'Could not delete the skill.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Skill Removed',
        description: `"${skillName}" has been removed from your profile.`,
      });
    }
  };

  const SkillsSkeleton = () => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
            <Badge className="h-8 w-24 animate-pulse" />
            <Badge className="h-8 w-32 animate-pulse" />
            <Badge className="h-8 w-20 animate-pulse" />
            <Badge className="h-8 w-28 animate-pulse" />
        </div>
        {isOwner && (
            <div className="mt-4 flex gap-2">
                <Input disabled className="h-10 w-full animate-pulse bg-gray-800/50" />
                <Button disabled className="w-24 h-10 animate-pulse" />
            </div>
        )}
    </div>
  );

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Skills</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <SkillsSkeleton /> : (
          <div>
            <div className="flex flex-wrap gap-2">
              {skills.length > 0 ? skills.map(skill => (
                <Badge key={skill.id} variant="secondary" className="group text-base px-3 py-1">
                  {skill.skill_name}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-6 w-6 opacity-50 group-hover:opacity-100"
                      onClick={() => handleDeleteSkill(skill.id, skill.skill_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Badge>
              )) : (
                <p className="text-muted-foreground text-sm">{isOwner ? "Add your skills below." : "No skills listed yet."}</p>
              )}
            </div>

            {isOwner && (
              <form onSubmit={handleAddSkill} className="mt-6 flex gap-2 items-center">
                <Input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="e.g., Cinematography"
                  className="bg-gray-800 border-gray-700"
                  disabled={isSubmitting}
                />
                <Button type="submit" disabled={!newSkill.trim() || isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} 
                  Add
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Skills;
