
import { ArrowRight, Sparkles, Users, Film } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

const EnhancedCTASection = () => {
  return (
    <section className="py-24 px-4 md:px-8 bg-gradient-to-r from-cinesphere-purple/20 via-cinesphere-dark to-cinesphere-blue/20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-cinesphere-purple rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-cinesphere-blue rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center px-4 py-2 bg-cinesphere-purple/20 rounded-full mb-6">
          <Sparkles className="h-4 w-4 text-cinesphere-purple mr-2" />
          <span className="text-sm font-medium text-cinesphere-purple">Join 10,000+ Film Professionals</span>
        </div>

        <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          <span className="text-gradient bg-gradient-to-r from-white via-cinesphere-light-purple to-cinesphere-blue bg-clip-text text-transparent">
            Ready to Create Your Next Masterpiece?
          </span>
        </h2>

        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          Whether you're a seasoned professional or just starting out, CineSphere is where your next great collaboration begins.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
          <Button asChild size="lg" className="bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90 text-lg px-8 py-4 h-auto shadow-2xl hover:shadow-cinesphere-purple/25">
            <Link to="/register" className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Join CineSphere
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="border-2 border-white/30 hover:bg-white/10 text-lg px-8 py-4 h-auto backdrop-blur-sm">
            <Link to="/explore" className="flex items-center">
              <Film className="mr-2 h-5 w-5" />
              Explore Projects
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">Free</div>
            <div className="text-sm text-gray-400">Always free to join</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">24/7</div>
            <div className="text-sm text-gray-400">Global community</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">Instant</div>
            <div className="text-sm text-gray-400">Start connecting today</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnhancedCTASection;
