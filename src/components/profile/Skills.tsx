import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Loader2, Sparkles, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
interface Skill {
  id: number;
  user_id: string;
  skill_name: string;
  created_at: string;
}

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
      const { data, error } = await (supabase
        .from('user_skills' as any)
        .select('*')
        .eq('user_id', userId) as any);

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

  const saveSkill = async (skillName: string) => {
    if (!user) return;
    
    if (skills.some(skill => skill.skill_name.toLowerCase() === skillName.toLowerCase())) {
      toast({
        title: 'Duplicate Skill',
        description: 'You have already added this skill.',
        variant: 'default',
      });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await (supabase
      .from('user_skills' as any)
      .insert({ user_id: user.id, skill_name: skillName } as any)
      .select()
      .single() as any);

    if (error) {
      toast({
        title: 'Error adding skill',
        description: error.message || 'Could not add the skill.',
        variant: 'destructive',
      });
    } else if (data) {
      setSkills(prevSkills => [...prevSkills, data]);
      toast({
        title: 'Skill Added',
        description: `"${skillName}" has been added to your profile.`,
      });
    }
    setIsSubmitting(false);
  };

  const handleAddSkill = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim() || !user) return;
    await saveSkill(newSkill.trim());
    setNewSkill('');
  };

  const handleDeleteSkill = async (skillId: number, skillName: string) => {
    const originalSkills = skills;
    setSkills(prevSkills => prevSkills.filter(s => s.id !== skillId));

    const { error } = await supabase
      .from('user_skills' as any)
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

  const ALL_SUGGESTIONS = [
    // Creative & Direction
    'Direction',
    'Screenwriting',
    'Acting',
    'Storyboarding',
    'Casting Direction',
    'Script Supervision',
    
    // Camera & Lighting
    'Cinematography',
    'Camera Operating',
    'Lighting',
    'Steadicam Operating',
    'Gaffer',
    'Grip',
    'Drone Operating',
    '1st AC (Focus Puller)',
    
    // Post-Production
    'Editing',
    'Color Grading',
    'VFX',
    '3D Animation',
    'Motion Graphics',
    
    // Sound & Music
    'Sound Design',
    'Sound Recording',
    'Sound Mixing',
    'Foley Art',
    'Music Composition',
    
    // Art & Wardrobe
    'Production Design',
    'Costume Design',
    'Hair & Makeup',
    'Set Design',
    
    // Production & Management
    'Producing',
    'Line Producing',
    'Location Scouting',
    'Production Assistant'
  ];

  const suggestedSkills = ALL_SUGGESTIONS.filter(
    suggestion => !skills.some(
      skill => skill.skill_name.toLowerCase() === suggestion.toLowerCase()
    )
  );

  return (
    <Card className="glass-card overflow-hidden border border-white/10 shadow-xl bg-background/30 backdrop-blur-md">
      <CardHeader className="border-b border-white/[0.05] bg-white/[0.01] px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">Skills</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? <SkillsSkeleton /> : (
          <div className="space-y-6">
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {skills.map(skill => (
                  <Badge
                    key={skill.id}
                    variant="secondary"
                    className="group text-sm font-semibold px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-foreground transition-all duration-300 rounded-full flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <Sparkles className="h-3 w-3 text-primary/70 group-hover:text-primary animate-pulse" />
                    <span>{skill.skill_name}</span>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full hover:bg-destructive/20 hover:text-destructive text-muted-foreground/60 transition-all ml-1.5 p-0"
                        onClick={() => handleDeleteSkill(skill.id, skill.skill_name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white/[0.01] border border-white/[0.05] rounded-2xl w-full">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
                  <Award className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-foreground font-semibold text-base mb-1">No Skills Listed</p>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {isOwner ? "Showcase your professional talents and crew capabilities by adding your skills." : "This user hasn't showcased any skills yet."}
                </p>
              </div>
            )}

            {isOwner && (
              <div className="pt-4 border-t border-white/[0.05] space-y-4">
                {suggestedSkills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Suggested Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSkills.map(suggestedName => (
                        <button
                          key={suggestedName}
                          type="button"
                          onClick={() => saveSkill(suggestedName)}
                          disabled={isSubmitting}
                          className="text-xs font-semibold px-3 py-1.5 bg-white/[0.02] hover:bg-primary/15 border border-white/5 hover:border-primary/30 text-muted-foreground hover:text-primary transition-all duration-300 rounded-full flex items-center gap-1 shadow-sm hover:scale-105 active:scale-95"
                        >
                          <Plus className="h-3 w-3 mr-1 text-primary/70" />
                          {suggestedName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleAddSkill} className="flex gap-2.5 items-center">
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="e.g., Cinematography, DaVinci Resolve, Lighting..."
                      className="bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 text-foreground placeholder:text-muted-foreground/50 h-10 rounded-lg px-4"
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!newSkill.trim() || isSubmitting}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-bold tracking-wide shadow-[0_4px_12px_rgba(var(--primary),0.2)] hover:shadow-[0_4px_20px_rgba(var(--primary),0.4)] transition-all rounded-lg px-5 h-10"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} 
                    Add
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Skills;
