
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Film, Briefcase, Tv, Award, Book } from "lucide-react";
import { Link } from "react-router-dom";

const Explore = () => {
  // Feature sections
  const features = [
    {
      icon: <Users size={32} className="text-cinesphere-purple" />,
      title: "Networking & Discovery",
      description: "Connect with professionals across all film crafts. Find collaborators based on skills, location, and availability.",
      link: "/network",
      linkText: "Browse Professionals"
    },
    {
      icon: <Film size={32} className="text-cinesphere-purple" />,
      title: "Portfolio Showcase",
      description: "Create a stunning profile with showreel, project history, and skills to showcase your unique talents.",
      link: "/profile",
      linkText: "Create Your Profile"
    },
    {
      icon: <Tv size={32} className="text-cinesphere-purple" />,
      title: "Content Sharing",
      description: "Share behind-the-scenes, work-in-progress, and finished projects with the community.",
      link: "/feed",
      linkText: "View Content Feed"
    },
    {
      icon: <Briefcase size={32} className="text-cinesphere-purple" />,
      title: "Job Marketplace",
      description: "Find your next gig or talent for your production with our specialized film industry job board.",
      link: "/jobs",
      linkText: "Browse Jobs"
    },
    {
      icon: <Book size={32} className="text-cinesphere-purple" />,
      title: "Project Collaboration",
      description: "Create project spaces to coordinate with your team, share files, and track progress.",
      link: "/projects",
      linkText: "Start a Project"
    },
    {
      icon: <Award size={32} className="text-cinesphere-purple" />,
      title: "Recognition",
      description: "Get noticed for your contributions and earn credibility through peer recommendations.",
      link: "/recognition",
      linkText: "Learn More"
    }
  ];

  // Craft categories
  const craftCategories = [
    "Direction", "Cinematography", "Production Design", "Editing", 
    "Sound Design", "Screenwriting", "Acting", "Costume Design",
    "Visual Effects", "Animation", "Makeup", "Stunt Coordination",
    "Music Composition", "Casting", "Art Direction", "Color Grading"
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="glass-card rounded-xl p-8 md:p-12 mb-16 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Discover the CineSphere Ecosystem
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              A complete platform designed specifically for film industry professionals to connect, collaborate, and create together.
            </p>
            <Button asChild size="lg" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              <Link to="/register">Join CineSphere Today</Link>
            </Button>
          </div>
          
          {/* Features Grid */}
          <h2 className="text-2xl font-bold mb-8 text-center">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <div key={index} className="glass-card rounded-xl p-6 flex flex-col h-full">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-300 mb-6 flex-grow">{feature.description}</p>
                <Button asChild variant="outline" className="mt-auto border-white/20 hover:bg-white/5 w-full">
                  <Link to={feature.link} className="flex items-center justify-center">
                    {feature.linkText} <ArrowRight size={16} className="ml-2" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
          
          {/* Crafts Section */}
          <h2 className="text-2xl font-bold mb-8 text-center">Connecting All 24 Film Crafts</h2>
          <div className="glass-card rounded-xl p-8 mb-16">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {craftCategories.map((craft) => (
                <div key={craft} className="bg-cinesphere-dark/50 rounded-lg p-3 text-center hover:bg-cinesphere-purple/20 transition-colors">
                  {craft}
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <p className="text-gray-400 mb-4">Find the right collaborators for any position in your production</p>
              <Button asChild className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                <Link to="/network">Browse by Craft</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Explore;
