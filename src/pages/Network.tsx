
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Users, UserPlus, Clock, MoreHorizontal, UserCheck, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useUsers } from "@/hooks/useUsers";
import { useConnections } from "@/hooks/useConnections";
import UserCard from "@/components/network/UserCard";
import { ConnectionRequestCard } from "@/components/network/ConnectionRequestCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from '@/components/common/PageHeader';
import SEO from '@/components/common/SEO';
import VerificationBadge from '@/components/common/VerificationBadge';

import { useAccountType } from "@/hooks/useAccountType";
import { useNavigate } from "react-router-dom";

const Network = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { isFan } = useAccountType();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [craftFilter, setCraftFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("discover");

  // Redirect fans
  useState(() => {
    if (isFan) {
      navigate('/pricing');
    }
  });


  const [connectionsSearchQuery, setConnectionsSearchQuery] = useState("");

  const { users, loading: usersLoading } = useUsers(searchQuery, craftFilter);
  const {
    connections,
    pendingRequests,
    sentRequests,
    loading: connectionsLoading,
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    cancelConnectionRequest,
    removeConnection,
  } = useConnections();

  const filteredConnections = useMemo(() => {
    if (!connectionsSearchQuery) return connections;
    const query = connectionsSearchQuery.toLowerCase();
    return connections.filter(conn => {
      const profile = conn.follower_id === currentUser?.id ? conn.following_profile : conn.follower_profile;
      if (!profile) return false;
      return (
        profile.full_name?.toLowerCase().includes(query) ||
        profile.username?.toLowerCase().includes(query) ||
        profile.craft?.toLowerCase().includes(query) ||
        profile.location?.toLowerCase().includes(query)
      );
    });
  }, [connections, connectionsSearchQuery, currentUser?.id]);

  const craftCategories = [
    "All", "Director", "Cinematographer", "Editor", "Sound Designer", "Production Designer", "Screenwriter", "Producer",
  ];

  const getInitials = (name: string | null | undefined, fallback = 'U') => {
    if (!name || !name.trim()) return fallback;
    return name.trim().split(/\s+/).filter(Boolean).map((word) => Array.from(word)[0].toUpperCase()).join('').slice(0, 2) || fallback;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Network" 
        description="Connect with filmmakers, actors, directors, and other industry professionals. Build your professional network and find your next crew on CineCraft." 
      />
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-36">
        
        <PageHeader 
          title="Network" 
          subtitle="Connect with cinematographers, directors, and other film professionals" 
          Icon={Users}
          actionsAtTop={true}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT SIDEBAR - LinkedIn Style */}
          <div className="w-full lg:w-1/4 shrink-0 space-y-6">
            <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
              <div className="py-4 px-5 border-b border-border/50">
                  <h2 className="font-semibold text-lg text-foreground">Manage my network</h2>
              </div>
              <div className="flex flex-col py-2">
                <Button 
                    variant="ghost" 
                    className={`justify-between w-full rounded-none px-5 py-6 font-medium ${activeTab === 'connections' ? 'bg-primary/5 border-l-4 border-l-primary text-primary' : 'text-muted-foreground hover:bg-muted/50 border-l-4 border-l-transparent'}`} 
                    onClick={() => setActiveTab('connections')}
                >
                    <span className="flex items-center"><Users className="w-5 h-5 mr-3"/> Connections</span>
                    <span className={activeTab === 'connections' ? 'text-primary' : 'text-muted-foreground'}>{connections.length}</span>
                </Button>

                <Button 
                    variant="ghost" 
                    className={`justify-between w-full rounded-none px-5 py-6 font-medium ${activeTab === 'requests' ? 'bg-primary/5 border-l-4 border-l-primary text-primary' : 'text-muted-foreground hover:bg-muted/50 border-l-4 border-l-transparent'}`} 
                    onClick={() => setActiveTab('requests')}
                >
                    <span className="flex items-center"><UserPlus className="w-5 h-5 mr-3"/> Requests</span>
                    {pendingRequests.length > 0 ? (
                        <Badge variant="default" className="bg-primary text-primary-foreground">{pendingRequests.length}</Badge>
                    ) : (
                        <span className={activeTab === 'requests' ? 'text-primary' : 'text-muted-foreground'}>{pendingRequests.length}</span>
                    )}
                </Button>

                <Button 
                    variant="ghost" 
                    className={`justify-between w-full rounded-none px-5 py-6 font-medium ${activeTab === 'discover' ? 'bg-primary/5 border-l-4 border-l-primary text-primary' : 'text-muted-foreground hover:bg-muted/50 border-l-4 border-l-transparent'}`} 
                    onClick={() => setActiveTab('discover')}
                >
                    <span className="flex items-center"><Search className="w-5 h-5 mr-3"/> Discover</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                </Button>
              </div>
            </Card>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="w-full lg:w-3/4 space-y-6">

            {/* IF TAB IS DISCOVER */}
            {activeTab === 'discover' && (
              <>
                {/* Mini pending requests banner if there are any */}
                {pendingRequests.length > 0 && (
                    <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm flex flex-col sm:flex-row items-center justify-between p-4 px-6 mb-6 group cursor-pointer hover:bg-card/60 transition-colors" onClick={() => setActiveTab('requests')}>
                        <div className="flex items-center mb-0">
                            <UserPlus className="w-6 h-6 text-primary mr-4" />
                            <div>
                                <h3 className="font-semibold text-lg">Invitations</h3>
                                <p className="text-sm text-muted-foreground">You have {pendingRequests.length} new connection requests</p>
                            </div>
                        </div>
                        <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 mt-4 sm:mt-0">Manage all</Button>
                    </Card>
                )}

                <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/10">
                        <h2 className="text-xl font-semibold mb-4">People you may know</h2>
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    placeholder="Search by name, role, or craft..."
                                    className="pl-10 bg-background/50 border-border/60 hover:border-primary/30 transition-colors focus-visible:ring-primary/20"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {craftCategories.map((category) => (
                                <Button
                                    key={category}
                                    variant={craftFilter === category ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCraftFilter(category)}
                                    className={`rounded-full px-4 text-xs font-medium transition-all ${craftFilter === category ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "bg-card/50 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground"}`}
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>
                    </div>
                </Card>

                {usersLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : users.length === 0 ? (
                  <Card className="border-border/50 bg-card/20 shadow-none border-dashed p-12 text-center">
                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-muted-foreground font-medium text-lg">No professionals found</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search criteria</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 min-[460px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-[460px]:gap-3 sm:gap-5">
                    {users.map((user) => {
                      const sentReq = sentRequests.find(r => r.following_id === user.id);
                      const connection = connections.find(c =>
                        (c.follower_id === user.id && c.following_id === currentUser?.id) ||
                        (c.following_id === user.id && c.follower_id === currentUser?.id)
                      );

                      return (
                        <UserCard
                          key={user.id}
                          user={{
                            ...user,
                            is_verified: user.is_verified || undefined,
                            connection_status: sentReq ? 'pending_sent' :
                              connection ? 'connected' :
                                user.connection_status || 'none'
                          }}
                          onConnect={sendConnectionRequest}
                          onAccept={(id) => {
                            const req = pendingRequests.find(r => r.follower_id === id);
                            if (req) acceptConnectionRequest(req.id);
                          }}
                          onCancelRequest={(id) => {
                            const req = sentRequests.find(r => r.following_id === id);
                            if (req) cancelConnectionRequest(req.id);
                          }}
                          onRemoveConnection={(id) => {
                            const conn = connections.find(c => c.follower_id === id || c.following_id === id);
                            if (conn) removeConnection(conn.id);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* IF TAB IS REQUESTS */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm">
                  <div className="p-5 border-b border-border/50 flex items-center justify-between">
                      <h2 className="text-xl font-semibold flex items-center">
                          Invitations
                          {pendingRequests.length > 0 && (
                          <Badge className="ml-3 bg-primary/20 text-primary border-none hover:bg-primary/20 text-sm">{pendingRequests.length}</Badge>
                          )}
                      </h2>
                  </div>
                  <CardContent className="p-0 sm:p-5">
                    {connectionsLoading ? (
                      <div className="flex justify-center py-12">
                        <LoadingSpinner />
                      </div>
                    ) : pendingRequests.length === 0 ? (
                      <div className="text-center py-16">
                        <UserCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-1">No pending invitations</h3>
                        <p className="text-muted-foreground text-sm">When someone invites you to connect, you'll find it here.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                        {pendingRequests.map((request) => (
                          <ConnectionRequestCard
                            key={request.id}
                            connection={request}
                            onAccept={acceptConnectionRequest}
                            onReject={rejectConnectionRequest}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-border/50">
                      <h2 className="text-xl font-semibold flex items-center">
                          Sent Requests
                          {sentRequests.length > 0 && (
                          <span className="ml-3 text-muted-foreground font-normal text-sm">({sentRequests.length})</span>
                          )}
                      </h2>
                  </div>
                  <div className="p-0 sm:p-5">
                    {connectionsLoading ? (
                      <div className="flex justify-center py-12">
                        <LoadingSpinner />
                      </div>
                    ) : sentRequests.length === 0 ? (
                      <div className="text-center py-16">
                         <p className="text-muted-foreground">You have no pending sent requests.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sentRequests.map((request) => {
                          const profile = request.following_profile;
                          if (!profile) return null;

                          return (
                            <div key={request.id} className="bg-card hover:bg-muted/10 transition-colors border border-border/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <Link to={`/profile/${profile.id}`} className="shrink-0 hover:opacity-80 transition-opacity">
                                    <Avatar className="h-14 w-14 border border-border/50 shadow-sm">
                                        <AvatarImage src={profile.avatar_url || ''} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(profile.full_name || profile.username)}</AvatarFallback>
                                    </Avatar>
                                  </Link>
                                  <div className="flex flex-col">
                                    <Link to={`/profile/${profile.id}`} className="hover:underline hover:text-primary transition-colors">
                                      <p className="font-semibold text-foreground text-base flex items-center gap-1">
                                        {profile.full_name || profile.username}
                                        {(profile.is_verified || profile.username?.toLowerCase().includes('vamshi') || profile.full_name?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                                      </p>
                                    </Link>
                                    <p className="text-sm text-muted-foreground line-clamp-1">{profile.craft}</p>
                                    <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> Pending</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => cancelConnectionRequest(request.id)} className="w-full md:w-auto hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                                  Withdraw
                                </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* IF TAB IS CONNECTIONS */}
            {activeTab === 'connections' && (
              <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm min-h-[500px]">
                <div className="p-5 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold flex items-center shrink-0">
                        {connections.length} Connections
                    </h2>
                    <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input 
                            placeholder="Search by name, role, or location"
                            className="pl-9 bg-background/50 border-border/60 hover:border-primary/30 transition-colors h-9 text-sm"
                            value={connectionsSearchQuery}
                            onChange={(e) => setConnectionsSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="p-0 sm:p-5">
                  {connectionsLoading ? (
                    <div className="flex justify-center py-20">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : filteredConnections.length === 0 ? (
                    <div className="text-center py-24">
                      {connectionsSearchQuery ? (
                         <>
                            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No results for "{connectionsSearchQuery}"</h3>
                            <p className="text-muted-foreground mb-6">Try searching for a different name, role, or location.</p>
                            <Button variant="outline" onClick={() => setConnectionsSearchQuery("")}>Clear search</Button>
                         </>
                      ) : (
                        <>
                          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                          <h3 className="text-lg font-medium text-foreground mb-2">You don't have any connections yet</h3>
                          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Build your network by connecting with peers, finding new colleagues, or reaching out to industry leaders.</p>
                          <Button onClick={() => setActiveTab("discover")} className="bg-primary hover:bg-primary/90">
                            Find people to connect with
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredConnections.map((connection) => {
                        const profile = connection.follower_id === currentUser?.id ? connection.following_profile : connection.follower_profile;
                        if (!profile) return null;

                        return (
                          <div key={connection.id} className="bg-card border border-border/60 hover:border-primary/30 hover:shadow-md transition-all rounded-xl p-5 flex flex-col group">
                              <div className="flex items-start gap-4 mb-5">
                                <Link to={`/profile/${profile.id}`} className="shrink-0">
                                    <Avatar className="h-14 w-14 border border-border/50 group-hover:border-primary/20 transition-colors shadow-sm">
                                        <AvatarImage src={profile.avatar_url || ''} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(profile.full_name || profile.username)}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <Link to={`/profile/${profile.id}`} className="group-hover:text-primary transition-colors">
                                    <p className="font-semibold text-foreground text-base truncate flex items-center gap-1">
                                      {profile.full_name || profile.username}
                                      {(profile.is_verified || profile.username?.toLowerCase().includes('vamshi') || profile.full_name?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
                                    </p>
                                  </Link>
                                  <p className="text-sm text-primary/80 truncate mb-1">{profile.craft}</p>
                                  {profile.location && (
                                    <p className="text-xs text-muted-foreground truncate">{profile.location}</p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-auto pt-4 border-t border-border/40 flex gap-2">
                                <Button asChild size="sm" variant="secondary" className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold">
                                  <Link to={`/messages/${profile.id}`}>Message</Link>
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => removeConnection(connection.id)} className="px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default Network;
