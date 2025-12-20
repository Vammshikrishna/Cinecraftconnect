import { useState } from 'react';
import { Plus, PenTool, Film, MessageSquare, Briefcase, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const UniversalCreateButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    interface Action {
        icon: any;
        label: string;
        path?: string;
        action?: () => void;
        color: string;
    }

    const actions: Action[] = [
        {
            icon: Megaphone,
            label: 'Create Announcement',
            path: '/announcements/new',
            color: 'bg-orange-500'
        },
        {
            icon: Briefcase,
            label: 'Post Job',
            path: '/jobs/new',
            color: 'bg-green-500'
        },
        {
            icon: MessageSquare,
            label: 'Start Discussion',
            path: '/discussion-rooms/new',
            color: 'bg-blue-500'
        },
        {
            icon: Film,
            label: 'New Project',
            path: '/projects/new',
            color: 'bg-purple-500'
        },
        {
            icon: PenTool,
            label: 'Create Post',
            path: '/feed/create',
            color: 'bg-pink-500'
        },
    ];

    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-4">
            <AnimatePresence>
                {isOpen && (
                    <div className="flex flex-col gap-3 items-end mb-2">
                        {actions.map((action, index) => (
                            <motion.div
                                key={action.label}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center gap-3"
                            >
                                <span className="bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-border">
                                    {action.label}
                                </span>
                                {action.path ? (
                                    <Link to={action.path} onClick={() => setIsOpen(false)}>
                                        <Button
                                            size="icon"
                                            className={cn("h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform", action.color)}
                                        >
                                            <action.icon className="h-5 w-5 text-white" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button
                                        size="icon"
                                        onClick={() => {
                                            action.action?.();
                                            setIsOpen(false);
                                        }}
                                        className={cn("h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform", action.color)}
                                    >
                                        <action.icon className="h-5 w-5 text-white" />
                                    </Button>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            <Button
                size="icon"
                onClick={toggleOpen}
                className={cn(
                    "h-16 w-16 rounded-full shadow-xl transition-all duration-300 hover:scale-105",
                    isOpen ? "bg-destructive hover:bg-destructive/90 rotate-45" : "bg-primary hover:bg-primary/90"
                )}
            >
                <Plus className={cn("h-8 w-8 transition-transform duration-300", isOpen && "rotate-45")} />
            </Button>
        </div>
    );
};

export default UniversalCreateButton;
