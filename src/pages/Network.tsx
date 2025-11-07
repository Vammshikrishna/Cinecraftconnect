import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, UserPlus, Clock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { useConnections } from "@/hooks/useConnections";
import { UserCard } from "@/components/network/UserCard";
import { ConnectionRequestCard } from "@/components/network/ConnectionRequestCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Link } from "react-router-dom";

const Network = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [craftFilter, setCraftFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("discover");

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

  const craftCategories = [
    "All",
    "Director",
    "Cinematographer",
    "Editor",
    "Sound Designer",
    "Production Designer",
    "Screenwriter",
    "Producer",
  ];

  const getInitials = (name: string | null | undefined, fallback = 'U') => {
    if (!name || !name.trim()) return fallback;
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => Array.from(word)[0].toUpperCase())
      .join('')
      .slice(0, 2);
    return initials || fallback;
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16">
        <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Network</h1>
              <p className="text-muted-foreground">
                Connect with fellow filmmakers and industry professionals
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid grid-cols-3 mb-6 bg-card border border-border">
              <TabsTrigger value="discover" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="mr-2 h-4 w-4" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
                <UserPlus className="mr-2 h-4 w-4" />
                Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="connections" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="mr-2 h-4 w-4" />
                Connections
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover">
              {/* Search and Filter Bar */}
              <Card className="mb-8 border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        placeholder="Search professionals by name or craft..."
                        className="pl-10 bg-background border-border"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-2">
                    {craftCategories.map((category) => (
                      <Button
                        key={category}
                        variant={craftFilter === category ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCraftFilter(category)}
                        className={craftFilter === category ? "btn-primary" : "border-border"}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Users Grid */}
              {usersLoading ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : users.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      onConnect={sendConnectionRequest}
                      onCancelRequest={cancelConnectionRequest}
                      onRemoveConnection={removeConnection}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requests">
              <div className="space-y-6">
                {/* Pending Requests */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-foreground">
                      <UserPlus className="mr-2 h-5 w-5" />
                      Pending Requests
                      {pendingRequests.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {pendingRequests.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>People who want to connect with you</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {connectionsLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : pendingRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No pending connection requests
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Sent Requests */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-foreground">
                      <Clock className="mr-2 h-5 w-5" />
                      Sent Requests
                      {sentRequests.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {sentRequests.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Requests you've sent to others</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {connectionsLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : sentRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No sent requests
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sentRequests.map((request) => {
                          const profile = request.following_profile;
                          if (!profile) return null;

                          return (
                            <div
                              key={request.id}
                              className="bg-card border border-border rounded-2xl p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                    {getInitials(profile.full_name || profile.username)}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground">
                                      {profile.full_name || profile.username}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{profile.craft}</p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelConnectionRequest(request.id)}
                                  className="border-border"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="connections">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <Users className="mr-2 h-5 w-5" />
                    Your Connections
                    {connections.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {connections.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    People you're connected with
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {connectionsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : connections.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No connections yet</p>
                      <Button onClick={() => setActiveTab("discover")} className="btn-primary">
                        Discover Professionals
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {connections.map((connection) => {
                        const profile =
                          connection.follower_profile?.id !== connection.follower_id
                            ? connection.follower_profile
                            : connection.following_profile;

                        if (!profile) return null;

                        return (
                          <div
                            key={connection.id}
                            className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between"
                          >
                            <div>
                                <div className="flex items-start gap-3 mb-3">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                    {getInitials(profile.full_name || profile.username)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">
                                    {profile.full_name || profile.username}
                                    </p>
                                    <p className="text-sm text-primary">{profile.craft}</p>
                                    {profile.location && (
                                    <p className="text-xs text-muted-foreground">{profile.location}</p>
                                    )}
                                </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeConnection(connection.id)}
                                className="w-full border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                                >
                                    Remove
                                </Button>
                                <Button asChild size="sm" className="w-full btn-primary">
                                    <Link to={`/dm/${profile.id}`} className="flex items-center justify-center">
                                        <MessageCircle className="w-4 h-4 mr-2"/>
                                        Message
                                    </Link>
                                </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Network;
