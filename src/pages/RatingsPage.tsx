
import RatingsTab from '@/components/feed/RatingsTab';
import { PageHeader } from '@/components/common/PageHeader';
import { Star } from 'lucide-react';

const RatingsPage = () => {
    return (
        <div className="min-h-screen bg-background pt-16 md:pt-20 pb-24 selection:bg-primary/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
                <PageHeader 
                  title="Rate Movies & Shows" 
                  subtitle="Discover trending content, rate what you've watched, and share your opinions with the community" 
                  Icon={Star}
                />

                <RatingsTab />
            </div>
        </div>
    );
};

export default RatingsPage;
