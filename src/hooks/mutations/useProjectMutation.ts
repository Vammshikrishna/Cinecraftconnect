import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useProjectMutation() {
  const { user } = useAuth();

  const createProject = async (payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'CREATE_PROJECT',
      { ...payload, ownerId: user.id, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const updateProject = async (projectId: string, payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'UPDATE_PROJECT',
      { ...payload, projectId },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteProject = async (projectId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_PROJECT',
      { projectId },
      { id: ClientIdManager.generate() }
    );
  };

  return { createProject, updateProject, deleteProject };
}
