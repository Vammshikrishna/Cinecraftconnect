
import { Star, Quote } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const ImprovedTestimonials = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Director",
      craft: "Direction",
      image: "https://images.unsplash.com/photo-1494790108755-2616c9c2dd6c?w=400&h=400&fit=crop&crop=face",
      content: "CineCraft Connect transformed how I find collaborators. I've connected with incredibly talented professionals who share my creative vision.",
      rating: 5,
      project: "Award-winning short film 'Echoes'"
    },
    {
      name: "Marcus Rodriguez",
      role: "Cinematographer", 
      craft: "Cinematography",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
      content: "The quality of projects and professionals on CineCraft Connect is unmatched. It's become my go-to platform for finding meaningful work.",
      rating: 5,
      project: "Netflix Original Series"
    },
    {
      name: "Emma Thompson",
      role: "Producer",
      craft: "Producing", 
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
      content: "From indie films to major productions, CineCraft Connect has helped me build teams that exceed expectations every single time.",
      rating: 5,
      project: "Sundance Film Festival Selection"
    }
  ];

  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-b from-black to-cinecraft-connect-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            <span className="text-gradient">Stories from Our Community</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Hear from the filmmakers, creators, and industry professionals who are bringing their visions to life through CineCraft Connect
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={testimonial.name}
              className="glass-card p-8 rounded-2xl border border-white/10 hover:border-cinecraft-connect-purple/50 transition-all duration-300 hover:scale-105"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="flex items-center mb-6">
                <Quote className="h-8 w-8 text-cinecraft-connect-purple mb-4" />
              </div>
              
              <p className="text-gray-300 mb-6 leading-relaxed italic">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              
              <div className="flex items-center">
                <Avatar className="h-12 w-12 mr-4">
                  <AvatarImage src={testimonial.image} alt={testimonial.name} />
                  <AvatarFallback>{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-cinecraft-connect-purple">{testimonial.role}</div>
                  <div className="text-xs text-gray-400">{testimonial.project}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImprovedTestimonials;
