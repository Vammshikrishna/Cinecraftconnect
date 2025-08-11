

import EnhancedHero from "@/components/EnhancedHero";
import EnhancedFeatures from "@/components/EnhancedFeatures";
import StatsSection from "@/components/StatsSection";
import ImprovedTestimonials from "@/components/ImprovedTestimonials";
import EnhancedCTASection from "@/components/EnhancedCTASection";
import Footer from "@/components/Footer";
import MovieRating from "@/components/MovieRating";
import Announcements from "@/components/Announcements";
import { Breadcrumb } from "@/components/Breadcrumb";

const Index = () => {
  // Mock data for latest rated releases
  const latestRatings = [
    {
      title: "The Last Journey",
      rating: 4.8,
      releaseDate: "2025-03-15",
      type: "Movie" as const,
    },
    {
      title: "Silent Echo", 
      rating: 4.5,
      releaseDate: "2025-04-01",
      type: "Short Film" as const,
    },
    {
      title: "Beyond Tomorrow",
      rating: 4.3,
      releaseDate: "2025-04-10", 
      type: "Movie" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      
      <Breadcrumb />
      <main className="pt-16">
        <EnhancedHero />
        <EnhancedFeatures />
        <StatsSection />
        
        {/* Announcements Section */}
        <Announcements />
        
        {/* Latest Rated Releases Section */}
        <section className="py-16 px-4 md:px-8 bg-gradient-to-b from-cinesphere-dark to-black">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="text-gradient">Latest Community Ratings</span>
              </h2>
              <p className="text-xl text-gray-300">
                See what the community is watching and rating
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestRatings.map((item, index) => (
                <div 
                  key={item.title}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  className="animate-fade-in"
                >
                  <MovieRating
                    title={item.title}
                    rating={item.rating}
                    releaseDate={item.releaseDate}
                    type={item.type}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <ImprovedTestimonials />
        <EnhancedCTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
