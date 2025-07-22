import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ModerationItem {
  id: string;
  content_id: string;
  content_type: string;
  content_text: string;
  moderation_status: string;
  ai_confidence: number;
  ai_flags: any;
  human_reviewed: boolean;
  human_reviewer_id?: string;
  moderation_reason?: string;
  moderated_at?: string;
  created_at: string;
}

const ContentModerationDashboard = () => {
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'flagged' | 'approved'>('pending');
  const { toast } = useToast();

  useEffect(() => {
    fetchModerationItems();
  }, [filter]);

  const fetchModerationItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('content_moderation')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setModerationItems(data || []);
    } catch (error) {
      console.error('Error fetching moderation items:', error);
      toast({
        title: "Error",
        description: "Failed to load moderation data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateModerationStatus = async (
    itemId: string, 
    status: string, 
    reason?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('content_moderation')
        .update({
          moderation_status: status,
          human_reviewed: true,
          human_reviewer_id: user.id,
          moderation_reason: reason,
          moderated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      // Refresh the list
      fetchModerationItems();

      toast({
        title: "Success",
        description: `Content ${status} successfully`,
      });
    } catch (error) {
      console.error('Error updating moderation status:', error);
      toast({
        title: "Error",
        description: "Failed to update moderation status",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'flagged': return <Flag className="h-4 w-4 text-red-500" />;
      case 'removed': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'flagged': return 'bg-red-500';
      case 'removed': return 'bg-red-600';
      default: return 'bg-yellow-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-red-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats = {
    total: moderationItems.length,
    pending: moderationItems.filter(item => item.moderation_status === 'pending').length,
    flagged: moderationItems.filter(item => item.moderation_status === 'flagged').length,
    approved: moderationItems.filter(item => item.moderation_status === 'approved').length,
    removed: moderationItems.filter(item => item.moderation_status === 'removed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Content Moderation</h2>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.flagged}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Removed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.removed}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="flagged">Flagged ({stats.flagged})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4">
          {moderationItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No content to moderate</h3>
                <p className="text-muted-foreground text-center">
                  {filter === 'pending' 
                    ? "All content has been reviewed!"
                    : `No ${filter} content found.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            moderationItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.moderation_status)}
                      <div>
                        <CardTitle className="text-sm">
                          {item.content_type.charAt(0).toUpperCase() + item.content_type.slice(1)} Content
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at))} ago
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusColor(item.moderation_status)}>
                        {item.moderation_status}
                      </Badge>
                      
                      {item.ai_confidence && (
                        <Badge variant="outline" className={getConfidenceColor(item.ai_confidence)}>
                          AI: {Math.round(item.ai_confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Content Preview */}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      {item.content_text?.substring(0, 200)}
                      {item.content_text?.length > 200 && '...'}
                    </p>
                  </div>

                  {/* AI Flags */}
                  {item.ai_flags && Array.isArray(item.ai_flags) && item.ai_flags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">AI Detected Issues:</h4>
                      <div className="flex flex-wrap gap-2">
                        {item.ai_flags.map((flag, index) => (
                          <Badge key={index} variant="destructive" className="text-xs">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human Review */}
                  {item.human_reviewed && item.moderation_reason && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Review Notes:</h4>
                      <p className="text-sm text-muted-foreground">{item.moderation_reason}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {item.moderation_status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateModerationStatus(item.id, 'approved', 'Content approved after review')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateModerationStatus(item.id, 'flagged', 'Content flagged for review')}
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Flag
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateModerationStatus(item.id, 'removed', 'Content removed for policy violation')}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentModerationDashboard;