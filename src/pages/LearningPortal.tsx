
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, Award, Book, CheckCircle, Clock, Star, Film } from "lucide-react";

const featuredCourses = [
  {
    title: "Introduction to Film Direction",
    description: "Learn the fundamentals of film direction from renowned directors.",
    instructor: "Christopher Nolan",
    duration: "8 weeks",
    level: "Beginner",
    craft: "Direction",
    enrolled: 2547,
    icon: <Film className="h-10 w-10 text-cinesphere-purple" />
  },
  {
    title: "Advanced Cinematography",
    description: "Master the art of visual storytelling through camera and lighting techniques.",
    instructor: "Roger Deakins",
    duration: "10 weeks",
    level: "Advanced",
    craft: "Cinematography",
    enrolled: 1876,
    icon: <Film className="h-10 w-10 text-cinesphere-purple" />
  },
  {
    title: "Screenwriting Essentials",
    description: "Learn the structure, format, and techniques of writing compelling screenplays.",
    instructor: "Aaron Sorkin",
    duration: "6 weeks",
    level: "Intermediate",
    craft: "Screenwriting",
    enrolled: 3241,
    icon: <Book className="h-10 w-10 text-cinesphere-purple" />
  },
  {
    title: "Film Editing Masterclass",
    description: "Discover the principles of editing that shape narrative and emotional impact.",
    instructor: "Thelma Schoonmaker",
    duration: "8 weeks",
    level: "Intermediate",
    craft: "Editing",
    enrolled: 1543,
    icon: <Film className="h-10 w-10 text-cinesphere-purple" />
  }
];

const LearningPortal = () => {
  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="glass-card rounded-xl p-8 md:p-12 mb-12 text-center">
            <div className="flex justify-center mb-6">
              <GraduationCap size={64} className="text-cinesphere-purple" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Master Your Craft with CineSphere Academy
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Learn from industry professionals with courses for all 24 film crafts. 
              Earn certifications and advance your career in film and television.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                Explore All Courses
              </Button>
              <Button variant="outline" size="lg" className="border-white/20 hover:bg-white/5">
                View Certification Paths
              </Button>
            </div>
          </div>
          
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center">
              <BookOpen className="h-8 w-8 text-cinesphere-purple mb-2" />
              <span className="text-3xl font-bold">120+</span>
              <span className="text-gray-400">Courses</span>
            </div>
            <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center">
              <Award className="h-8 w-8 text-cinesphere-purple mb-2" />
              <span className="text-3xl font-bold">24</span>
              <span className="text-gray-400">Craft Certifications</span>
            </div>
            <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center">
              <Star className="h-8 w-8 text-cinesphere-purple mb-2" />
              <span className="text-3xl font-bold">98%</span>
              <span className="text-gray-400">Satisfaction Rate</span>
            </div>
            <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center">
              <CheckCircle className="h-8 w-8 text-cinesphere-purple mb-2" />
              <span className="text-3xl font-bold">15,000+</span>
              <span className="text-gray-400">Certified Professionals</span>
            </div>
          </div>
          
          {/* Featured Courses */}
          <h2 className="text-2xl font-bold mb-6">Featured Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {featuredCourses.map((course, index) => (
              <div key={index} className="glass-card rounded-xl p-6 flex flex-col h-full">
                <div className="flex gap-4 items-start mb-4">
                  <div className="bg-cinesphere-dark/50 p-3 rounded-lg">
                    {course.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{course.title}</h3>
                    <p className="text-sm text-gray-400">{course.craft} • {course.level}</p>
                  </div>
                </div>
                <p className="text-gray-300 mb-4">{course.description}</p>
                <div className="flex items-center text-sm text-gray-400 mb-4 mt-auto">
                  <div className="flex items-center mr-4">
                    <Clock className="h-4 w-4 mr-1" />
                    {course.duration}
                  </div>
                  <div>
                    {course.enrolled.toLocaleString()} students enrolled
                  </div>
                </div>
                <Button className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                  Enroll Now
                </Button>
              </div>
            ))}
          </div>
          
          {/* Certification Paths */}
          <div className="glass-card rounded-xl p-8 mb-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Craft Certification Paths</h2>
                <p className="text-gray-300 max-w-2xl mb-4">
                  Each certification path is designed by industry experts to help you master a specific film craft
                  through a series of courses, projects, and assessments.
                </p>
                <Button asChild variant="outline" className="border-white/20 hover:bg-white/5">
                  <Link to="/learning/certifications">View All Certification Paths</Link>
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col items-center glass-card p-4 rounded-xl">
                  <BookOpen className="h-6 w-6 text-cinesphere-purple mb-1" />
                  <span className="text-sm">Learn</span>
                </div>
                <div className="flex items-center">→</div>
                <div className="flex flex-col items-center glass-card p-4 rounded-xl">
                  <Film className="h-6 w-6 text-cinesphere-purple mb-1" />
                  <span className="text-sm">Create</span>
                </div>
                <div className="flex items-center">→</div>
                <div className="flex flex-col items-center glass-card p-4 rounded-xl">
                  <Award className="h-6 w-6 text-cinesphere-purple mb-1" />
                  <span className="text-sm">Certify</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* CTA Section */}
          <div className="glass-card rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Master Your Craft?</h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-6">
              Join thousands of film professionals who have advanced their careers through CineSphere Academy.
              Start your learning journey today.
            </p>
            <Button size="lg" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              Create Free Account
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LearningPortal;
