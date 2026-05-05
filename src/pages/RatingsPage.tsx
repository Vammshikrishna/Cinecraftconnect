import { useState } from 'react';
import RatingsTab from '@/components/feed/RatingsTab';
import { PageHeader } from '@/components/common/PageHeader';
import { Star, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitCinemaModal } from '@/components/cinema/SubmitCinemaModal';

const RatingsPage = () => {
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background pt-20 pb-36 selection:bg-primary/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
                <PageHeader 
                  title="Ratings" 
                  subtitle="Discover trending content, rate what you've watched, and showcase your own cinematic creations" 
                  Icon={Star}
                  actionsAtTop={true}
                  actions={
                    <Button 
                        onClick={() => setIsSubmitModalOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 h-12 px-6 rounded-xl group transition-all"
                    >
                        <Upload className="h-5 w-5 mr-2 group-hover:-translate-y-1 transition-transform" />
                        Submit Your Work
                    </Button>
                  }
                />

                <RatingsTab />
            </div>

            <SubmitCinemaModal 
                isOpen={isSubmitModalOpen} 
                onClose={() => setIsSubmitModalOpen(false)} 
            />
        </div>
    );
};

export default RatingsPage;
