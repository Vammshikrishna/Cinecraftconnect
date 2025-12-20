
import { ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center py-20 px-4 md:px-8 overflow-hidden">
      {/* Animated Film Strip Background */}
      <div className="absolute top-1/4 -left-10 right-0 film-strip animate-film-scroll opacity-10">
        {[...Array(24)].map((_, i) => (
          <div key={i} className="film-strip-frame" />
        ))}
      </div>
      <div className="absolute top-2/4 -left-10 right-0 film-strip animate-film-scroll opacity-10" style={{ animationDelay: '-5s' }}>
        {[...Array(24)].map((_, i) => (
          <div key={i} className="film-strip-frame" />
        ))}
      </div>
      <div className="absolute top-3/4 -left-10 right-0 film-strip animate-film-scroll opacity-10" style={{ animationDelay: '-10s' }}>
        {[...Array(24)].map((_, i) => (
          <div key={i} className="film-strip-frame" />
        ))}
      </div>
      
      {/* Hero Content */}
      <div className="max-w-3xl mx-auto text-center z-10 animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          <span className="text-gradient">Connect, Collaborate, Create</span>
        </h1>
        <div className="highlight-bar mx-auto mb-6"></div>
        <p className="text-xl md:text-2xl text-gray-300 mb-8">
          The professional network for the film industry.
          From directors to makeup artists, find your next collaboration on CineSphere.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
            <Link to="/register">Join CineSphere</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/20 hover:bg-white/5">
            <Link to="/explore" className="flex items-center">
              Explore <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Crafts Display */}
      <div className="mt-16 md:mt-24 max-w-4xl mx-auto text-center">
        <h2 className="text-xl md:text-2xl font-semibold mb-6 text-gradient">Connecting All 24 Film Crafts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {['Direction', 'Cinematography', 'Production Design', 'Editing', 
            'Sound Design', 'Screenwriting', 'Acting', 'Costume Design'].map((craft) => (
            <Link to={`/craft/${craft.toLowerCase().replace(' ', '-')}`} key={craft}>
              <div className="glass-card p-3 rounded-lg hover:bg-cinesphere-purple/20 transition-colors">
                {craft}
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-400">And 16 more film crafts...</p>
      </div>
    </div>
  );
};

export default Hero;
