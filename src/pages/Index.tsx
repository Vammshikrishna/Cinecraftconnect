
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import MovieRating from "@/components/MovieRating";

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
      <Navbar />
      <main className="pt-16">
        <Hero />
        <Features />
        
        {/* Latest Rated Releases Section */}
        <section className="py-16 px-4 md:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Latest Rated Releases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestRatings.map((item) => (
                <MovieRating
                  key={item.title}
                  title={item.title}
                  rating={item.rating}
                  releaseDate={item.releaseDate}
                  type={item.type}
                />
              ))}
            </div>
          </div>
        </section>

        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
