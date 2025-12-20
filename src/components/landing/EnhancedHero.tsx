import { ArrowRight, Play, Users, Award, Briefcase } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
const EnhancedHero = () => {
  const stats = [{
    icon: Users,
    value: "10K+",
    label: "Film Professionals"
  }, {
    icon: Briefcase,
    value: "500+",
    label: "Active Projects"
  }, {
    icon: Award,
    value: "24",
    label: "Film Crafts"
  }, {
    icon: Play,
    value: "1K+",
    label: "Success Stories"
  }];
  return <div className="relative min-h-screen flex flex-col justify-center items-center py-20 px-4 md:px-8 overflow-hidden">
      {/* Enhanced Animated Film Strip Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 -left-10 right-0 film-strip animate-film-scroll">
          {[...Array(30)].map((_, i) => <div key={i} className="film-strip-frame bg-gradient-to-r from-cinecraft-connect-purple to-cinecraft-connect-blue" />)}
        </div>
        <div className="absolute top-2/4 -left-10 right-0 film-strip animate-film-scroll" style={{
        animationDelay: '-5s'
      }}>
          {[...Array(30)].map((_, i) => <div key={i} className="film-strip-frame bg-gradient-to-r from-cinecraft-connect-blue to-cinecraft-connect-purple" />)}
        </div>
        <div className="absolute top-3/4 -left-10 right-0 film-strip animate-film-scroll" style={{
        animationDelay: '-10s'
      }}>
          {[...Array(30)].map((_, i) => <div key={i} className="film-strip-frame bg-gradient-to-r from-cinecraft-connect-purple to-cinecraft-connect-blue" />)}
        </div>
      </div>
      
      {/* Enhanced Hero Content */}
      <div className="max-w-4xl mx-auto text-center z-10 animate-fade-in">
        <div className="mb-6">
          <span className="inline-block px-4 py-2 bg-cinecraft-connect-purple/20 text-cinecraft-connect-purple rounded-full text-sm font-medium mb-4">
            🎬 The Future of Film Collaboration
          </span>
        </div>
        
        <h1 className="text-4xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="text-gradient bg-gradient-to-r from-cinecraft-connect-purple via-cinecraft-connect-blue to-cinecraft-connect-light-purple bg-clip-text text-transparent">
            Connect, Collaborate, Create
          </span>
        </h1>
        
        <div className="highlight-bar mx-auto mb-8"></div>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
          Join the world's most innovative platform for film professionals. 
          From visionary directors to talented makeup artists, discover your next collaboration and bring stories to life.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button asChild size="lg" className="bg-gradient-to-r from-cinecraft-connect-purple to-cinecraft-connect-blue hover:from-cinecraft-connect-purple/90 hover:to-cinecraft-connect-blue/90 text-lg px-8 py-4 h-auto">
            <Link to="/register" className="flex items-center">
              Join CineCraft Connect <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-2 border-cinecraft-connect-purple/30 hover:bg-cinecraft-connect-purple/10 text-lg px-8 py-4 h-auto">
            <Link to="/explore" className="flex items-center">
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Link>
          </Button>
        </div>

        {/* Stats Section */}
        
      </div>
      
      {/* Enhanced Crafts Display */}
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">
          <span className="text-gradient">Connecting All 24 Film Crafts</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
          {['Direction', 'Cinematography', 'Production Design', 'Editing', 'Sound Design', 'Screenwriting', 'Acting', 'Costume Design', 'VFX', 'Animation', 'Music', 'Casting', 'Producing', 'Lighting', 'Makeup', 'Stunts'].map(craft => <Link to={`/craft/${craft.toLowerCase().replace(' ', '-')}`} key={craft}>
              <div className="glass-card p-4 rounded-xl hover:bg-cinecraft-connect-purple/20 transition-all duration-300 hover:scale-105 hover:shadow-lg border border-white/10">
                <span className="font-medium">{craft}</span>
              </div>
            </Link>)}
        </div>
        <p className="mt-6 text-gray-400">And many more specialized roles...</p>
      </div>
    </div>;
};
export default EnhancedHero;
