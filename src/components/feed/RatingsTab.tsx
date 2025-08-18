import MovieRating from '@/components/MovieRating';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RatingsTab = () => {
  // Mock data for latest rated releases (moved from Index)
  const latestRatings = [
    {
      title: "The Last Journey",
      rating: 4.8,
      releaseDate: "2025-03-15",
      type: "Movie" as const,
    },
    {
      title: "Silent Echo", 
      rating: 4.5,
      releaseDate: "2025-04-01",
      type: "Short Film" as const,
    },
    {
      title: "Beyond Tomorrow",
      rating: 4.3,
      releaseDate: "2025-04-10", 
      type: "Movie" as const,
    },
    {
      title: "Midnight Tales",
      rating: 4.6,
      releaseDate: "2025-03-28",
      type: "Short Film" as const,
    },
    {
      title: "Digital Dreams",
      rating: 4.2,
      releaseDate: "2025-04-05",
      type: "Movie" as const,
    },
    {
      title: "Ocean's Mystery",
      rating: 4.7,
      releaseDate: "2025-03-20",
      type: "Movie" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            <span className="text-gradient">Latest Community Ratings</span>
          </CardTitle>
          <p className="text-center text-muted-foreground">
            See what the community is watching and rating
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestRatings.map((item, index) => (
              <div 
                key={item.title}
                style={{ animationDelay: `${index * 0.1}s` }}
                className="animate-fade-in"
              >
                <MovieRating
                  title={item.title}
                  rating={item.rating}
                  releaseDate={item.releaseDate}
                  type={item.type}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RatingsTab;