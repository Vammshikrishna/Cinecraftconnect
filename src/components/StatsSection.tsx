
import { TrendingUp, Users, Film, Award } from 'lucide-react';

const StatsSection = () => {
  const stats = [
    {
      icon: Users,
      value: "10,000+",
      label: "Active Professionals",
      description: "Creators across all film crafts"
    },
    {
      icon: Film,
      value: "2,500+",
      label: "Projects Completed",
      description: "From shorts to features"
    },
    {
      icon: TrendingUp,
      value: "98%",
      label: "Success Rate",
      description: "Projects finding their teams"
    },
    {
      icon: Award,
      value: "150+",
      label: "Awards Won",
      description: "By our community members"
    }
  ];

  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-r from-cinesphere-purple/10 to-cinesphere-blue/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-gradient">Trusted by Film Professionals Worldwide</span>
          </h2>
          <p className="text-xl text-gray-300">
            Join a thriving community that's reshaping how films get made
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div 
              key={stat.label}
              className="text-center group"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="h-8 w-8 text-white" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2 group-hover:text-gradient transition-colors">
                {stat.value}
              </div>
              <div className="text-lg font-semibold text-gray-200 mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-gray-400">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
