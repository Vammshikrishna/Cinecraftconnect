import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Building2, ChevronDown, BookOpen } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const MoreMenu = () => {
    const location = useLocation();

    const moreItems = [
        { path: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
        { path: '/vendors', icon: Building2, label: 'Vendors' },
        { path: '/learn', icon: BookOpen, label: 'Learn' }
    ];

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
                {moreItems.map(({ path, icon: Icon, label }) => (
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default MoreMenu;
