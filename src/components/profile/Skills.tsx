
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

// Manual type definition for a skill
interface Skill {
  id: number;
  user_id: string;
  skill_name: string;
}

const Skills = ({ userId, isOwner }: { userId: string, isOwner: boolean }) => {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_skills')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleAddSkill = async () => {
    if (!newSkill.trim() || !user) return;

    const { data, error } = await supabase
      .from('user_skills')
      .insert({ user_id: user.id, skill_name: newSkill.trim() })
      .select();

    if (error) {
      console.error('Error adding skill:', error);
    } else if (data) {
      setSkills(prevSkills => [...prevSkills, data[0]]);
      setNewSkill('');
    }
  };

  const handleDeleteSkill = async (skillId: number) => {
    const { error } = await supabase
      .from('user_skills')
      .delete()
      .eq('id', skillId);

    if (error) {
      console.error('Error deleting skill:', error);
    } else {
      setSkills(prevSkills => prevSkills.filter(s => s.id !== skillId));
    }
  };

  if (loading) {
    return <div>Loading skills...</div>;
  }

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Skills</h3>
      <div className="flex flex-wrap gap-2">
        {skills.map(skill => (
          <div key={skill.id} className="flex items-center bg-gray-800 rounded-full px-4 py-2 text-sm">
            <span>{skill.skill_name}</span>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-6 w-6"
                onClick={() => handleDeleteSkill(skill.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {isOwner && (
        <div className="mt-4 flex gap-2">
          <Input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add a new skill..."
            className="bg-gray-800 border-gray-700"
          />
          <Button onClick={handleAddSkill}><Plus size={16} /> Add</Button>
        </div>
      )}
    </div>
  );
};

export default Skills;
