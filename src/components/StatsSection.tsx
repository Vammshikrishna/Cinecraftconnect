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
  return <section className="py-20 px-4 md:px-8 bg-gradient-to-r from-cinesphere-purple/10 to-cinesphere-blue/10">
      
    </section>;
};
export default StatsSection;