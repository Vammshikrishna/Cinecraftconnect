import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import { BackButton } from '@/components/common/BackButton';
import SEO from '@/components/common/SEO';

const CreateProject = () => {
  return (
    <div className="min-h-dvh bg-background pt-24 pb-20">
      <SEO 
        title="Create Space" 
        description="Create a new workspace for your film production, recruit crew, and collaborate." 
      />
      <div className="max-w-[1152px] mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <BackButton />
        </div>
        {/* the form itself opens the new space when it is created, so nothing else navigates here */}
        <ProjectCreationModal isModal={false} />
      </div>
    </div>
  );
};

export default CreateProject;
