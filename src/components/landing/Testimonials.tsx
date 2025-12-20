
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const testimonials = [
  {
    quote: "CineSphere has completely transformed how I connect with other filmmakers. I found my entire crew for my last short film here.",
    name: "Alex Rivera",
    role: "Director & Producer",
    initials: "AR"
  },
  {
    quote: "As a cinematographer, having a platform specifically for film professionals has been invaluable. The craft-specific feeds keep me inspired.",
    name: "Maya Chen",
    role: "Cinematographer",
    initials: "MC"
  },
  {
    quote: "I've been hired for three major productions through CineSphere's job board. The platform understands the unique needs of film professionals.",
    name: "James Wilson",
    role: "Production Designer",
    initials: "JW"
  }
];

const Testimonials = () => {
  return (
    <div className="py-20 px-4 md:px-8 bg-cinesphere-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">From the Community</h2>
          <div className="highlight-bar mx-auto mb-6"></div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="glass-card rounded-xl p-6 flex flex-col h-full">
              <div className="flex-1">
                <p className="text-lg italic mb-6">"{testimonial.quote}"</p>
              </div>
              <div className="flex items-center mt-4">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback className="bg-cinesphere-purple/30 text-white">{testimonial.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
