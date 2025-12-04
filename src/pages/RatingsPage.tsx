import RatingsTab from '@/components/feed/RatingsTab';

const RatingsPage = () => {
    return (
        <div className="min-h-screen bg-background pt-20 pb-24">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold text-foreground mb-2">
                        Rate Movies & Shows
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Discover trending content, rate what you've watched, and share your opinions with the community
                    </p>
                </div>

                <RatingsTab />
            </div>
        </div>
    );
};

export default RatingsPage;
