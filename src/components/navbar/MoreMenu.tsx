import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ChevronDown, BookOpen, Star, Megaphone, MessageSquare } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAccountType } from '@/hooks/useAccountType';
import VendorIcon from '@/components/icons/VendorIcon';
import StudioPageIcon from '@/components/icons/StudioPageIcon';

const MoreMenu = () => {
    const location = useLocation();
    const { isFan } = useAccountType();

    // Items available to everyone (fans + creators)
    const commonItems = [
        { path: '/ratings', icon: Star, label: 'Ratings' },
        { path: '/announcements', icon: Megaphone, label: 'Announcements' },
        { path: '/pages', icon: StudioPageIcon, label: 'Pages' },
    ];


    // Creator-only items
    const creatorItems = [
        { path: '/messages', icon: MessageSquare, label: 'Messages' },
        { path: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
        { path: '/vendors', icon: VendorIcon, label: 'Vendors' },
        { path: '/learn', icon: BookOpen, label: 'Learn' },
    ];

    const moreItems = isFan ? commonItems : [...commonItems, ...creatorItems];

    // Check if any of the "more" items is active
    const isAnyActive = moreItems.some(item => location.pathname.startsWith(item.path));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 hover-lift relative ${isAnyActive ? 'nav-item-active' : 'nav-item-inactive'
                        }`}
                >
                    <span className="font-medium text-sm">More</span>
                    <ChevronDown size={16} className="flex-shrink-0" />
                    {isAnyActive && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-primary to-primary/80 rounded-full"></div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {commonItems.map(({ path, icon: Icon, label }) => (
                    <DropdownMenuItem key={path} asChild>
                        <Link
                            to={path}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${location.pathname.startsWith(path) ? 'bg-primary/10 text-primary' : ''
                                }`}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </Link>
                    </DropdownMenuItem>
                ))}

                {/* Creator-only section */}
                {!isFan && (
                    <>
                        <DropdownMenuSeparator />
                        {creatorItems.map(({ path, icon: Icon, label }) => (
                            <DropdownMenuItem key={path} asChild>
                                <Link
                                    to={path}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${location.pathname.startsWith(path) ? 'bg-primary/10 text-primary' : ''
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span>{label}</span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default MoreMenu;
