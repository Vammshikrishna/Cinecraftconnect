import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ChevronDown, BookOpen, Star, Megaphone, Flag, Shield, Crown, Lightbulb, FileSignature, ArrowLeftRight } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { useUnreadPitchSubmissions } from '@/hooks/useUnreadPitchSubmissions';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import VendorIcon from '@/components/icons/VendorIcon';
import StudioPageIcon from '@/components/icons/StudioPageIcon';
import { AccountSwitcherSheet } from '@/components/profile/AccountSwitcherSheet';

const MoreMenu = () => {
  const { t } = useT();
    const location = useLocation();
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const { isFan, isCreator, isStudio } = useAccountType();
    const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
    const { unreadPitchCount, hasUnreadPitches } = useUnreadPitchSubmissions();
    const { unreadAnnouncements } = useUnreadAnnouncements();

    // Items available to everyone (fans + creators)
    const commonItems = [
        { path: '/ratings', icon: Star, label: 'Ratings', key: 'nav.ratings' },
        { path: '/announcements', icon: Megaphone, label: 'Announcements', key: 'nav.announcements' },
        { path: '/pages', icon: StudioPageIcon, label: 'Pages', key: 'nav.pages' },
    ];

    // Creator-only items
    const creatorItems = [
        { path: '/marketplace', icon: ShoppingBag, label: 'Marketplace', key: 'nav.marketplace' },
        { path: '/pitch', icon: Lightbulb, label: 'Pitch', key: 'nav.pitch' },
    ];

    // Governance items — shown only to privileged roles
    const governanceItems = [
        ...(isModerator ? [{ path: '/moderation', icon: Flag, label: 'Moderation', color: 'text-amber-500' }] : []),
        ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin Panel', color: 'text-blue-500' }] : []),
        ...(isSuperAdmin ? [{ path: '/super-admin', icon: Crown, label: 'Super Admin', color: 'text-amber-500' }] : []),
    ];

    const moreItems = isFan ? commonItems : [...commonItems, ...creatorItems];

    // Check if any of the "more" items is active
    const isAnyActive = [...moreItems, ...governanceItems].some(item => location.pathname.startsWith(item.path));

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-[color,background-color,transform,box-shadow] duration-200 hover-lift relative ${isAnyActive ? 'nav-item-active' : 'nav-item-inactive'
                        }`}
                >
                    <span className="font-serif font-bold uppercase tracking-tight text-[12px] lg:text-sm">More</span>
                    <ChevronDown size={16} className="flex-shrink-0" />
                    {isAnyActive && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-primary to-primary/80 rounded-full"></div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {commonItems.map(({ path, icon: Icon, label, key }) => (
                    <DropdownMenuItem key={path} asChild>
                        <Link
                            to={path}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${location.pathname.startsWith(path) ? 'bg-primary/10 text-primary' : ''
                                }`}
                        >
                            <Icon size={18} />
                            <span className="font-serif font-bold uppercase tracking-tight text-[12px] lg:text-[12px] flex-1">{t(key as any)}</span>
                            {path === '/announcements' && unreadAnnouncements > 0 && (
                                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                                    {unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}
                                </span>
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}

                {/* Creator-only section */}
                {!isFan && (
                    <>
                        <DropdownMenuSeparator />
                        {creatorItems.map(({ path, icon: Icon, label, key }) => (
                            <DropdownMenuItem key={path} asChild>
                                <Link
                                    to={path}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${location.pathname.startsWith(path) ? 'bg-primary/10 text-primary' : ''
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span className="font-serif font-bold uppercase tracking-tight text-[12px] lg:text-[12px] flex-1">{t(key as any)}</span>
                                    {/* Notification badge for Pitch inbox */}
                                    {path === '/pitch' && (isCreator || isStudio) && hasUnreadPitches && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[12px] font-bold text-white">
                                            {unreadPitchCount > 9 ? '9+' : unreadPitchCount}
                                        </span>
                                    )}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSwitcherOpen(true)} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                    <ArrowLeftRight size={18} />
                    <span className="font-medium">Switch account</span>
                </DropdownMenuItem>

                {/* Governance section — moderators, admins, super_admins only */}
                {governanceItems.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="px-3 py-1">
                            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Internal</p>
                        </div>
                        {governanceItems.map(({ path, icon: Icon, label, color }) => (
                            <DropdownMenuItem key={path} asChild>
                                <Link
                                    to={path}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${location.pathname.startsWith(path) ? 'bg-primary/10 text-primary' : ''}`}
                                >
                                    <Icon size={18} className={color} />
                                    <span className={`font-bold ${color}`}>{label}</span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
        <AccountSwitcherSheet isOpen={switcherOpen} onOpenChange={setSwitcherOpen} />
        </>
    );
};

export default MoreMenu;

