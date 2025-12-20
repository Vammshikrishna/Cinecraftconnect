import { TrendingUp, Users, Film, Award } from 'lucide-react';

const StatsSection = () => {
  const stats = [{
    icon: Users,
    value: "10,000+",
    label: "Active Professionals",
    description: "Creators across all film crafts"
  }, {
    icon: Film,
    value: "2,500+",
    label: "Projects Completed",
    description: "From shorts to features"
  }, {
    icon: TrendingUp,
    value: "98%",
    label: "Success Rate",
    description: "Projects finding their teams"
  }, {
    icon: Award,
    value: "150+",
    label: "Awards Won",
    description: "By our community members"
  }];
  
  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-r from-cinecraft-connect-purple/10 to-cinecraft-connect-blue/10">
      <div className="container mx-auto text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl mb-12">
          Join a Thriving Community
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div 
              key={stat.label} 
              className="bg-white/5 backdrop-blur-sm p-6 rounded-lg text-center transition-all duration-300 hover:bg-white/10 hover:shadow-lg hover:-translate-y-2"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              <div className="mb-4 inline-block p-4 bg-cinecraft-connect-purple/10 rounded-full">
                  <stat.icon className="h-8 w-8 text-cinecraft-connect-purple" aria-hidden="true" />
              </div>
              <p className="text-4xl font-bold text-white">{stat.value}</p>
              <p className="mt-2 text-lg font-medium text-white/90">{stat.label}</p>
              <p className="mt-1 text-sm text-white/70">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
