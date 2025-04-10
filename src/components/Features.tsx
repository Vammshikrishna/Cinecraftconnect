
import { Film, Users, Tv, Briefcase, BookOpen, Award } from 'lucide-react';

const features = [
  {
    icon: <Users className="h-10 w-10 text-cinesphere-purple" />,
    title: "Networking & Discovery",
    description: "Connect with professionals across all film crafts. Find collaborators based on skills, location, and availability."
  },
  {
    icon: <Film className="h-10 w-10 text-cinesphere-purple" />,
    title: "Portfolio Showcase",
    description: "Create a stunning profile with showreel, project history, and skills to showcase your unique talents."
  },
  {
    icon: <Tv className="h-10 w-10 text-cinesphere-purple" />,
    title: "Content Sharing",
    description: "Share behind-the-scenes, work-in-progress, and finished projects with the community."
  },
  {
    icon: <Briefcase className="h-10 w-10 text-cinesphere-purple" />,
    title: "Job Marketplace",
    description: "Find your next gig or talent for your production with our specialized film industry job board."
  },
  {
    icon: <BookOpen className="h-10 w-10 text-cinesphere-purple" />,
    title: "Project Collaboration",
    description: "Create project spaces to coordinate with your team, share files, and track progress."
  },
  {
    icon: <Award className="h-10 w-10 text-cinesphere-purple" />,
    title: "Recognition",
    description: "Get noticed for your contributions and earn credibility through peer recommendations."
  },
];

const Features = () => {
  return (
    <div className="py-20 px-4 md:px-8 bg-gradient-to-b from-cinesphere-dark to-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Platform Features</h2>
          <div className="highlight-bar mx-auto mb-6"></div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Everything you need to build your network and advance your film career
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="glass-card rounded-xl p-6 transition-all duration-300 hover:translate-y-[-5px]">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;
