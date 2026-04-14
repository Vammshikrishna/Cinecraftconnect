
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, Award, Book, CheckCircle, Clock, Star, Film } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

const featuredCourses = [
  {
    title: "Introduction to Film Direction",
    description: "Learn the fundamentals of film direction from renowned directors.",
    instructor: "Christopher Nolan",
    duration: "8 weeks",
    level: "Beginner",
    craft: "Direction",
    enrolled: 2547,
    icon: <Film className="h-10 w-10 text-primary" />
  },
  {
    title: "Advanced Cinematography",
    description: "Master the art of visual storytelling through camera and lighting techniques.",
    instructor: "Roger Deakins",
    duration: "10 weeks",
    level: "Advanced",
    craft: "Cinematography",
    enrolled: 1876,
    icon: <Film className="h-10 w-10 text-primary" />
  },
  {
    title: "Screenwriting Essentials",
    description: "Learn the structure, format, and techniques of writing compelling screenplays.",
    instructor: "Aaron Sorkin",
    duration: "6 weeks",
    level: "Intermediate",
    craft: "Screenwriting",
    enrolled: 3241,
    icon: <Book className="h-10 w-10 text-primary" />
  },
  {
    title: "Film Editing Masterclass",
    description: "Discover the principles of editing that shape narrative and emotional impact.",
    instructor: "Thelma Schoonmaker",
    duration: "8 weeks",
    level: "Intermediate",
    craft: "Editing",
    enrolled: 1543,
    icon: <Film className="h-10 w-10 text-primary" />
  }
];

const LearningPortal = () => {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-20 pb-24 relative z-10">
        <PageHeader 
          title="Learning Portal" 
          subtitle="Master your craft with industry-standard courses and production masterclasses" 
          Icon={GraduationCap}
        />

        <div className="max-w-6xl mx-auto">
          {/* Hero Content Re-styled */}
          <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 md:p-12 mb-12 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="flex justify-center mb-8">
              <div className="h-20 w-20 rounded-[2rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/5">
                <GraduationCap size={48} className="text-primary" />
              </div>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight leading-none">
              Master Your Craft with CineSphere Academy
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 font-medium leading-relaxed">
              Learn from industry professionals with courses for all film crafts. 
              Earn certifications and advance your career in film and television.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-14 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                Explore All Courses
              </Button>
              <Button variant="ghost" size="lg" className="border border-border/50 hover:bg-muted/50 font-black px-8 h-14 rounded-2xl transition-all">
                View Certification Paths
              </Button>
            </div>
          </div>
          
          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
            <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
              <BookOpen className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black tracking-tighter">120+</span>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mt-1">Courses</span>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
              <Award className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black tracking-tighter">24</span>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mt-1">Certifications</span>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
              <Star className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black tracking-tighter">98%</span>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mt-1">Success Rate</span>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
              <CheckCircle className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black tracking-tighter">15K+</span>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mt-1">Professionals</span>
            </div>
          </div>
          
          {/* Featured Courses */}
          <div className="flex items-center gap-3 mb-8">
            <Film className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-black tracking-tight uppercase">Featured Masterclasses</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-20">
            {featuredCourses.map((course, index) => (
              <div key={index} className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 flex flex-col h-full group hover:border-primary/30 hover:shadow-2xl transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/[0.03] to-transparent opacity-100" />
                
                <div className="flex gap-5 items-start mb-6">
                  <div className="bg-primary/10 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    {course.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors leading-tight mb-1">{course.title}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">{course.craft} • {course.level}</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8 flex-1 font-medium">
                  {course.description}
                  <span className="block mt-2 text-sm text-foreground/60 font-black">— {course.instructor}</span>
                </p>
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-8 pt-6 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary/40" />
                    {course.duration}
                  </div>
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-primary/40" />
                    {course.enrolled.toLocaleString()} Students
                  </div>
                </div>
                <Button className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-xl shadow-primary/10 group-hover:scale-[1.02] transition-all">
                  Enroll Now
                </Button>
              </div>
            ))}
          </div>
          
          {/* Certification Paths */}
          <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 md:p-12 mb-20 group relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Craft Certification Paths</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mb-8 font-medium leading-relaxed">
                  Each certification path is designed by industry experts to help you master a specific film craft
                  through a series of courses, projects, and rigorous assessments.
                </p>
                <Button asChild variant="ghost" className="h-14 px-8 rounded-2xl border border-border/50 hover:bg-muted/50 font-black uppercase tracking-widest text-xs">
                  <Link to="/learning/certifications">View All Certification Paths</Link>
                </Button>
              </div>
              <div className="flex gap-4 p-6 bg-background/40 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="flex flex-col items-center glass-card p-5 rounded-2xl w-24 text-center">
                  <BookOpen className="h-6 w-6 text-primary mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Learn</span>
                </div>
                <div className="flex items-center text-primary/30">→</div>
                <div className="flex flex-col items-center glass-card p-5 rounded-2xl w-24 text-center">
                  <Film className="h-6 w-6 text-primary mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Create</span>
                </div>
                <div className="flex items-center text-primary/30">→</div>
                <div className="flex flex-col items-center glass-card p-5 rounded-2xl w-24 text-center">
                  <Award className="h-6 w-6 text-primary mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Certify</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* CTA Section */}
          <div className="bg-primary/5 border border-primary/20 rounded-[3rem] p-10 md:p-16 text-center space-y-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Ready to Master Your Craft?</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
              Join thousands of film professionals who have advanced their careers through CineSphere Academy.
              Start your learning journey today.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 h-16 rounded-2xl text-xl shadow-2xl shadow-primary/20 hover:scale-105 transition-transform">
              Create Your Master Account
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const UsersIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default LearningPortal;
