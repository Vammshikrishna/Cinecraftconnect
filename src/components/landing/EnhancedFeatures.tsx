
import { Users, Briefcase, MessageCircle, Award, Search, Zap, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

const EnhancedFeatures = () => {
  const features = [
    {
      icon: Users,
      title: "Professional Networking",
      description: "Connect with industry professionals across all 24 film crafts. Build meaningful relationships that advance your career.",
      link: "/network",
      color: "from-blue-500 to-purple-600"
    },
    {
      icon: Briefcase,
      title: "Project Collaboration",
      description: "Find your next project or build your dream team. From indie films to major productions.",
      link: "/projects",
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: MessageCircle,
      title: "Industry Discussions",
      description: "Join conversations about trends, techniques, and opportunities in specialized discussion rooms.",
      link: "/discussion-rooms",
      color: "from-green-500 to-blue-600"
    },
    {
      icon: Award,
      title: "Showcase Your Work",
      description: "Build an impressive portfolio that highlights your best work and attracts the right opportunities.",
      link: "/profile",
      color: "from-orange-500 to-red-600"
    },
    {
      icon: Search,
      title: "Smart Discovery",
      description: "AI-powered matching helps you discover relevant projects, collaborators, and opportunities.",
      link: "/explore",
      color: "from-cyan-500 to-blue-600"
    },
    {
      icon: Zap,
      title: "Real-time Collaboration",
      description: "Stay connected with your team through integrated messaging, file sharing, and project updates.",
      link: "/chats",
      color: "from-yellow-500 to-orange-600"
    }
  ];

  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-b from-cinecraft-connect-dark to-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="text-gradient">Everything You Need to Succeed</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            From pre-production to post, CineCraft Connect provides the tools and connections 
            you need to bring your creative vision to life.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="group relative glass-card p-8 rounded-2xl hover:scale-105 transition-all duration-300 hover:shadow-2xl border border-white/10"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold mb-4 text-white group-hover:text-gradient transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                {feature.description}
              </p>
              
              <Button asChild variant="ghost" className="text-cinecraft-connect-purple hover:text-white hover:bg-cinecraft-connect-purple/20 p-0">
                <Link to={feature.link} className="flex items-center">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Button asChild size="lg" className="bg-gradient-to-r from-cinecraft-connect-purple to-cinecraft-connect-blue hover:from-cinecraft-connect-purple/90 hover:to-cinecraft-connect-blue/90">
            <Link to="/register">Get Started Today</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default EnhancedFeatures;
