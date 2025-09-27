import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import UserProfileMenu from "./UserProfileMenu";
import LogoutButton from "./LogoutButton";

const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="p-2">
          <Menu size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Link 
            to="/profile" 
            className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors py-2"
            onClick={() => setIsOpen(false)}
          >
            <Users size={20} />
            <span>Profile</span>
          </Link>
          <Link 
            to="/settings" 
            className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors py-2"
            onClick={() => setIsOpen(false)}
          >
            <Settings size={20} />
            <span>Settings</span>
          </Link>
          <div className="pt-4 border-t border-border space-y-2">
            <UserProfileMenu />
            <LogoutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;