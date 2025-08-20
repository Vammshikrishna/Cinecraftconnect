import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, X, ThumbsUp, Eye, UserPlus, MessageCircle, Briefcase } from "lucide-react";

interface Recommendation {
  id: string;
  recommendation_type: string;
  recommended_id: string;
  recommended_type: string;
  score: number;
  reason: string;
  ai_model: string;
  interaction_data: any;
  is_shown: boolean;
  is_clicked: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface RecommendedContent {
  id: string;
  type: string;
  title: string;
  description?: string;
  author?: string;
  tags?: string[];
  score: number;
  reason: string;
}

const RecommendationsPanel = () => {
  const [recommendations, setRecommendations] = useState<RecommendedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      // Show mock data for now since database tables might not exist yet
      const mockRecommendations: RecommendedContent[] = [
        {
          id: '1',
          type: 'project',
          title: 'Sci-Fi Short Film: "Echoes"',
          description: 'Looking for cinematographer experienced with futuristic aesthetics',
          tags: ['sci-fi', 'short-film', 'cinematography'],
          score: 0.95,
          reason: 'Based on your interest in sci-fi projects and cinematography skills'
        },
        {
          id: '2',
          type: 'user',
          title: 'Maya Chen - Film Director',
          description: 'Independent filmmaker specializing in experimental narratives',
          tags: ['director', 'experimental', 'indie'],
          score: 0.87,
          reason: 'Similar creative style and project interests'
        },
        {
          id: '3',
          type: 'collaboration',
          title: 'Documentary Series - Sound Design',
          description: 'Remote collaboration opportunity for nature documentary',
          tags: ['documentary', 'sound-design', 'remote'],
          score: 0.78,
          reason: 'Matches your audio production background'
        },
        {
          id: '4',
          type: 'post',
          title: 'New editing techniques for indie films...',
          description: '45 likes, 12 comments',
          tags: ['editing', 'techniques', 'indie'],
          score: 0.82,
          reason: 'Popular among filmmakers with similar interests'
        }
      ];

      setRecommendations(mockRecommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to load recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationClick = async (recommendationId: string) => {
    try {
      await supabase
        .from('ai_recommendations')
        .update({ 
          is_clicked: true,
          is_shown: true 
        })
        .eq('id', recommendationId);

      // Track analytics
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_analytics')
          .insert([
            {
              user_id: user.id,
              event_type: 'recommendation_click',
              event_data: { recommendation_id: recommendationId },
              page_url: window.location.pathname
            }
          ]);
      }
    } catch (error) {
      console.error('Error tracking recommendation click:', error);
    }
  };

  const dismissRecommendation = async (recommendationId: string) => {
    try {
      await supabase
        .from('ai_recommendations')
        .update({ is_dismissed: true })
        .eq('id', recommendationId);

      setRecommendations(prev => 
        prev.filter(rec => rec.id !== recommendationId)
      );

      toast({
        title: "Recommendation dismissed",
        description: "We'll improve future recommendations based on your feedback",
      });
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'post': return <MessageCircle className="h-5 w-5" />;
      case 'user': return <UserPlus className="h-5 w-5" />;
      case 'project': return <Briefcase className="h-5 w-5" />;
      case 'collaboration': return <UserPlus className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No recommendations yet</h3>
            <p className="text-sm text-muted-foreground">
              Keep using the platform and we'll provide personalized recommendations for you.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
              {getRecommendationIcon(recommendation.type)}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{recommendation.title}</h4>
                  {recommendation.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {recommendation.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-3">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getScoreColor(recommendation.score)}`} />
                    <span className="text-xs text-muted-foreground">
                      {Math.round(recommendation.score * 100)}%
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissRecommendation(recommendation.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {recommendation.reason && (
                <p className="text-xs text-muted-foreground italic">
                  {recommendation.reason}
                </p>
              )}

              {recommendation.tags && recommendation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recommendation.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => handleRecommendationClick(recommendation.id)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => {
                    handleRecommendationClick(recommendation.id);
                    // Add to favorites or show interest
                  }}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Interested
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RecommendationsPanel;