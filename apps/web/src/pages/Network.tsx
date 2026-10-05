
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Users, UserPlus, UserCheck, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useUsers, PEOPLE_PAGE, PeopleFilters } from "@/hooks/useUsers";
import { useConnections } from "@/hooks/useConnections";
import { ConnectNoteDialog } from "@/components/network/ConnectNoteDialog";
import { CollaboratorsRow } from "@/components/network/CollaboratorsRow";
import { NetworkInsights } from "@/components/network/NetworkInsights";
import { IntroductionsPanel } from "@/components/network/IntroductionsPanel";
import { WorkRequestsPanel } from "@/components/network/WorkRequestsPanel";
import { Link } from "react-router-dom";
import { useFollows } from "@/hooks/useFollows";
import UserCard from "@/components/network/UserCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from '@/components/common/PageHeader';
import SEO from '@/components/common/SEO';

import { useAccountType } from "@/hooks/useAccountType";
import { useAppNavigation } from "@/contexts/NavigationContext";

const Network = () => {
  const { user: currentUser } = useAuth();
  const { push } = useAppNavigation();
  const { isFan } = useAccountType();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [craftFilter, setCraftFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("discover");

  const [connectionsSearchQuery, setConnectionsSearchQuery] = useState("");
  const [connSort, setConnSort] = useState<'recent' | 'name' | 'craft' | 'location'>('recent');
  const [connectTarget, setConnectTarget] = useState<{ id: string; name: string; defaultNote?: string } | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PeopleFilters>({});
  const [filters, setFilters] = useState<PeopleFilters>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  // Update default tab for Fans
  useEffect(() => {
    if (isFan && activeTab === 'discover') {
      setActiveTab('discover-creators');
    }
  }, [isFan]);

  const {
    connections,
    pendingRequests,
    sentRequests,
    ignoredRequests,
    ignoreRequest,
    unignoreRequest,
    loading: connectionsLoading,
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    cancelConnectionRequest,
    removeConnection,
  } = useConnections();

  const {
    following,
    sendFollow,
    deleteFollow
  } = useFollows();

  // Determine account type filter for useUsers
  const accountTypeFilter = activeTab === 'discover-creators' ? 'creator' : activeTab === 'discover-fans' ? 'fan' : null;

  const [limit, setLimit] = useState(PEOPLE_PAGE);
  useEffect(() => { setLimit(PEOPLE_PAGE); }, [searchQuery, craftFilter, accountTypeFilter, availableOnly, filters]);
  const { users, hasMore, loading: usersLoading, dismiss } = useUsers(searchQuery, craftFilter, !connectionsLoading, accountTypeFilter, limit, availableOnly, filters);

  const [dismissedUserIds, setDismissedUserIds] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    dismiss(id);
    setDismissedUserIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const filteredConnections = useMemo(() => {
    const other = (conn: any) => (conn.follower_id === currentUser?.id ? conn.following_profile : conn.follower_profile) || {};
    const tagged = tagFilter ? connections.filter((c: any) => (c.my_tags || []).includes(tagFilter)) : connections;
    const sorted = [...tagged].sort((a: any, b: any) => {
      if (connSort === 'recent') return 0;
      const key = connSort === 'name' ? 'full_name' : connSort;
      return String(other(a)[key] || '\uffff').localeCompare(String(other(b)[key] || '\uffff'));
    });
    if (!connectionsSearchQuery) return sorted;
    const query = connectionsSearchQuery.toLowerCase();
    return sorted.filter(conn => {
      const profile = conn.follower_id === currentUser?.id ? conn.following_profile : conn.follower_profile;
      if (!profile) return false;
      return (
        profile.full_name?.toLowerCase().includes(query) ||
        profile.username?.toLowerCase().includes(query) ||
        profile.craft?.toLowerCase().includes(query) ||
        profile.location?.toLowerCase().includes(query)
      );
    });
  }, [connections, connectionsSearchQuery, connSort, tagFilter, currentUser?.id]);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    connections.forEach((c: any) => (c.my_tags || []).forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [connections]);

  const craftCategories = [
    "All", "Director", "Cinematographer", "Editor", "Sound Designer", "Production Designer", "Screenwriter", "Producer",
  ];


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
          actions={!isFan && (
            <Button asChild variant="outline" className="h-10 px-5 rounded-xl">
              <Link to="/network/shortlists">Crew shortlists</Link>
            </Button>
          )}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT SIDEBAR */}
          <div className="w-full lg:w-1/4 shrink-0 space-y-6">
            <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
              <div className="py-4 px-5 border-b border-border/50">
                  <h2 className="font-semibold text-lg text-foreground">Manage my network</h2>
              </div>
              <div className="flex flex-col py-2">
                {!isFan ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <Button 
                        variant="ghost" 
                        className={`justify-between w-full rounded-none px-5 py-6 font-medium ${activeTab === 'discover-creators' ? 'bg-primary/5 border-l-4 border-l-primary text-primary' : 'text-muted-foreground hover:bg-muted/50 border-l-4 border-l-transparent'}`} 
                        onClick={() => setActiveTab('discover-creators')}
                    >
                        <span className="flex items-center"><Search className="w-5 h-5 mr-3"/> Discover Creators</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        className={`justify-between w-full rounded-none px-5 py-6 font-medium ${activeTab === 'discover-fans' ? 'bg-primary/5 border-l-4 border-l-primary text-primary' : 'text-muted-foreground hover:bg-muted/50 border-l-4 border-l-transparent'}`} 
                        onClick={() => setActiveTab('discover-fans')}
                    >
                        <span className="flex items-center"><Users className="w-5 h-5 mr-3"/> Discover Fans</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="w-full lg:w-3/4 space-y-6">

            {/* IF TAB IS DISCOVER OR FAN DISCOVER */}
            {(activeTab === 'discover' || activeTab === 'discover-creators' || activeTab === 'discover-fans') && (
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

                {!isFan && activeTab === 'discover' && !searchQuery && craftFilter === 'All' && !availableOnly && (
                  <CollaboratorsRow onConnect={(id, name, defaultNote) => setConnectTarget({ id, name, defaultNote })} />
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
                        {showFilters && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                                {([['skill', 'Skill, e.g. Color Grading'], ['gear', 'Gear, e.g. ARRI Alexa'], ['language', 'Language'], ['city', 'City']] as const).map(([k, ph]) => (
                                    <Input key={k} placeholder={ph} value={draftFilters[k] || ''} className="bg-background/50"
                                        onChange={(e) => setDraftFilters(f => ({ ...f, [k]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && setFilters(draftFilters)} />
                                ))}
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => setFilters(draftFilters)}>Apply</Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setDraftFilters({}); setFilters({}); }}>Clear</Button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={availableOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => setAvailableOnly(v => !v)}
                                className={`rounded-full px-4 text-xs font-medium ${availableOnly ? "bg-emerald-600 hover:bg-emerald-600/90 text-white" : "bg-card/50 border-emerald-500/40 text-emerald-600"}`}
                            >
                                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current inline-block" /> Available now
                            </Button>
                            <Button
                                variant={showFilters || Object.values(filters).some(Boolean) ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowFilters(v => !v)}
                                className="rounded-full px-4 text-xs font-medium"
                            >
                                More filters{Object.values(filters).some(Boolean) ? ' •' : ''}
                            </Button>
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3">
                    {users
                      .filter(user => !dismissedUserIds.has(user.id))
                      .map((user) => {
                        const sentReq = sentRequests.find(r => r.following_id === user.id);
                        const receivedReq = pendingRequests.find(r => r.follower_id === user.id);
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
                              connection_status: connection ? 'connected' : 
                                sentReq ? 'pending_sent' : 
                                receivedReq ? 'pending_received' :
                                  user.connection_status || 'none'
                            }}
                            onConnect={(id: string) => setConnectTarget({ id, name: user.full_name || user.username || 'this person' })}
                            onAccept={(id: string) => {
                              const req = pendingRequests.find(r => r.follower_id === id);
                              if (req) acceptConnectionRequest(req.id);
                            }}
                            onReject={(id: string) => {
                              const req = pendingRequests.find(r => r.follower_id === id);
                              if (req) rejectConnectionRequest(req.id);
                            }}
                            onCancelRequest={(id: string) => {
                              const req = sentRequests.find(r => r.following_id === id);
                              if (req) cancelConnectionRequest(req.id);
                            }}
                            onRemoveConnection={(id: string) => {
                              const conn = connections.find(c => c.follower_id === id || c.following_id === id);
                              if (conn) removeConnection(conn.id);
                            }}
                            onDismiss={handleDismiss}
                            isFanFollowMode={isFan}
                            isFollowing={isFan ? following.some(f => f.following_id === user.id) : undefined}
                            onFollow={(id) => sendFollow(id)}
                            onUnfollow={(id) => {
                              const f = following.find(f => f.following_id === id);
                              if (f) deleteFollow(f.id);
                            }}
                          />
                        );
                      })}
                  </div>
                )}

                {hasMore && !usersLoading && (
                  <div className="text-center pt-2">
                    <Button variant="outline" onClick={() => setLimit(l => l + PEOPLE_PAGE)}>Show more people</Button>
                  </div>
                )}
              </>
            )}

            {/* IF TAB IS REQUESTS */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                <IntroductionsPanel />
                <WorkRequestsPanel />
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3">
                        {pendingRequests.map((request) => (
                          <div key={request.id} className="w-full">
                            <UserCard
                              user={{
                                ...(request.follower_profile as any),
                                connection_status: 'pending_received',
                                suggestion_reason: (request.mutual_count || 0) > 0 ? `${request.mutual_count} mutual connection${request.mutual_count === 1 ? '' : 's'}` : 'Pending connection',
                                note: request.note,
                              }}
                              onAccept={() => acceptConnectionRequest(request.id)}
                              onReject={() => rejectConnectionRequest(request.id)}
                              onIgnore={() => ignoreRequest(request.id)}
                            />
                          </div>
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3">
                        {sentRequests.map((request) => {
                          const profile = request.following_profile;
                          if (!profile) return null;
 
                          return (
                            <div key={request.id} className="w-full">
                              <UserCard
                                user={{
                                  ...(profile as any),
                                  connection_status: 'pending_sent',
                                  suggestion_reason: 'Pending connection'
                                }}
                                onCancelRequest={() => cancelConnectionRequest(request.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>

                {ignoredRequests.length > 0 && (
                  <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
                    <button className="w-full p-5 flex items-center justify-between text-left" onClick={() => setShowIgnored(v => !v)}>
                      <h2 className="text-xl font-semibold">Ignored <span className="ml-2 text-muted-foreground font-normal text-sm">({ignoredRequests.length})</span></h2>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showIgnored ? 'rotate-90' : ''}`} />
                    </button>
                    {showIgnored && (
                      <div className="p-0 sm:p-5 border-t border-border/50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                        {ignoredRequests.map((request) => (
                          <div key={request.id} className="w-full">
                            <UserCard
                              user={{
                                ...(request.follower_profile as any),
                                connection_status: 'pending_received',
                                suggestion_reason: 'Ignored request',
                                note: request.note,
                              }}
                              onAccept={() => acceptConnectionRequest(request.id)}
                              onReject={() => rejectConnectionRequest(request.id)}
                              onIgnore={() => unignoreRequest(request.id)}
                              ignoreLabel="Move back to invitations"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* IF TAB IS CONNECTIONS */}
            {activeTab === 'connections' && (
              <div className="space-y-6">
              <NetworkInsights />
              <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm min-h-[500px]">
                <div className="p-5 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold flex items-center shrink-0">
                        {connections.length} Connections
                    </h2>
                    <select
                        value={connSort}
                        onChange={(e) => setConnSort(e.target.value as any)}
                        className="h-9 rounded-md border border-border/60 bg-background/50 px-2 text-sm"
                        aria-label="Sort connections"
                    >
                        <option value="recent">Recently added</option>
                        <option value="name">Name (A–Z)</option>
                        <option value="craft">Craft</option>
                        <option value="location">Location</option>
                    </select>
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
                {allTags.length > 0 && (
                  <div className="px-5 py-3 border-b border-border/50 flex flex-wrap gap-1.5">
                    <button onClick={() => setTagFilter(null)} className={`text-xs rounded-full border px-2.5 py-1 ${tagFilter === null ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                    {allTags.map(t => (
                      <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)} className={`text-xs rounded-full border px-2.5 py-1 ${tagFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground'}`}>#{t}</button>
                    ))}
                  </div>
                )}
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
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3">
                      {filteredConnections.map((connection) => {
                        const profile = connection.follower_id === currentUser?.id ? connection.following_profile : connection.follower_profile;
                        if (!profile) return null;
                        
                        return (
                          <div key={connection.id} className="w-full">
                            <UserCard
                              user={{
                                ...profile,
                                connection_status: 'connected',
                                availability: connection.availability,
                                my_note: connection.my_note,
                                my_tags: connection.my_tags,
                                suggestion_reason: (connection.mutual_count || 0) > 0 ? `${connection.mutual_count} mutual connection${connection.mutual_count === 1 ? '' : 's'}` : 'Connected'
                              }}
                              onRemoveConnection={() => removeConnection(connection.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
              </div>
            )}

          </div>
        </div>
      </main>

      <ConnectNoteDialog
        open={!!connectTarget}
        onOpenChange={(o) => !o && setConnectTarget(null)}
        name={connectTarget?.name || ''}
        defaultNote={connectTarget?.defaultNote}
        onSend={(note) => { if (connectTarget) sendConnectionRequest(connectTarget.id, note); }}
      />
    </div>
  );
};

export default Network;
