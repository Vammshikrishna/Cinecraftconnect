
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import FeedAnnouncementCard from "./FeedAnnouncementCard";
import FeedProjectCard from "./FeedProjectCard";
import FeedDiscussionCard from "./FeedDiscussionCard";
import FeedRatingCard from "./FeedRatingCard";
import FeedMarketplaceCard from "./FeedMarketplaceCard";
import FeedVendorCard from "./FeedVendorCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

export const FirstContentBlock = ({ announcements, projects, discussions, ratings }: { announcements: any[], projects: any[], discussions: any[], ratings: any[] }) => {
    return (
        <div className="space-y-4 lg:space-y-5 my-4 lg:my-5">
            {/* Announcements Carousel */}
            {announcements.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Latest Announcements</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {announcements.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal">
                                    <FeedAnnouncementCard announcement={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Trending Projects Carousel */}
            {projects.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Trending Projects</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {projects.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal">
                                    <FeedProjectCard project={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Active Discussions Carousel */}
            {discussions.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Active Discussions</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {discussions.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal h-full">
                                    <FeedDiscussionCard discussion={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Latest Ratings Carousel */}
            {ratings.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Latest Ratings</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {ratings.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal">
                                    <FeedRatingCard rating={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}
        </div>
    );
};


export const SecondContentBlock = ({ creators, marketplace, vendors, onConnect }: { creators: any[], marketplace: any[], vendors: any[], onConnect?: (id: string) => void }) => {
    return (
        <div className="space-y-4 lg:space-y-5 my-4 lg:my-5">
            {/* Connect with Creators */}
            {creators.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Connect with Creators</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {creators.map((creator) => (
                                <div key={creator.id} className="w-[140px] lg:w-[150px] p-3 lg:p-4 rounded-xl border bg-card text-card-foreground shadow flex flex-col items-center gap-2 lg:gap-3">
                                    <Link to={`/profile/${creator.id}`}>
                                        <Avatar className="h-14 w-14 lg:h-16 lg:w-16">
                                            <AvatarImage src={creator.avatar_url} />
                                            <AvatarFallback>{creator.username?.[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </Link>
                                    <div className="text-center w-full">
                                        <p className="font-semibold text-sm lg:text-base truncate w-full">{creator.full_name || creator.username}</p>
                                        <p className="text-[11px] lg:text-xs text-muted-foreground truncate w-full">{creator.craft || 'Creator'}</p>
                                    </div>
                                    <Button size="sm" className="w-full gap-1.5 lg:gap-2 h-8 lg:h-9" variant="outline" onClick={() => onConnect?.(creator.id)}>
                                        <UserPlus className="h-3.5 w-3.5 lg:h-4 lg:w-4" /> <span className="text-xs lg:text-sm">Connect</span>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Marketplace Highlights */}
            {marketplace.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Marketplace Highlights</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {marketplace.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal">
                                    <FeedMarketplaceCard item={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Featured Vendors */}
            {vendors.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base lg:text-lg font-semibold px-1">Featured Vendors</h3>
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                        <div className="flex w-max space-x-3 lg:space-x-4 p-3 lg:p-4">
                            {vendors.map((item) => (
                                <div key={item.id} className="w-[220px] lg:w-[240px] whitespace-normal">
                                    <FeedVendorCard vendor={item} />
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}
        </div>
    );
};
