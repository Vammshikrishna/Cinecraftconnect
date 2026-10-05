import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useJobMutation() {
  const { user } = useAuth();

  const createJob = async (payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'CREATE_JOB',
      { ...payload, employerId: user.id, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const applyForJob = async (jobId: string, payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'APPLY_JOB',
      { ...payload, jobId, applicantId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  const updateJob = async (jobId: string, payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'UPDATE_JOB',
      { ...payload, jobId, employerId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { createJob, applyForJob, updateJob };
}
