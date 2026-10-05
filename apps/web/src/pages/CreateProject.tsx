import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { BackButton } from '@/components/common/BackButton';
import SEO from '@/components/common/SEO';

const CreateProject = () => {
  const { push } = useAppNavigation();

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <SEO 
        title="Create Space" 
        description="Create a new workspace for your film production, recruit crew, and collaborate." 
      />
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <BackButton />
        </div>
        <ProjectCreationModal isModal={false} onProjectCreated={() => push('/projects')} />
      </div>
    </div>
  );
};

export default CreateProject;
