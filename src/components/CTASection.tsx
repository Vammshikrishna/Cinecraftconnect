
import { ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

const CTASection = () => {
  return (
    <div className="py-20 px-4 md:px-8 bg-gradient-to-r from-cinesphere-dark to-black">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to elevate your film career?
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Join thousands of film professionals building connections, finding opportunities, and showcasing their work.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
            <Link to="/register">Create Your Profile</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/20 hover:bg-white/5">
            <Link to="/explore" className="flex items-center">
              Explore Features <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CTASection;
