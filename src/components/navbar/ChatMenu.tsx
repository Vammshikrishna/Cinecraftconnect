
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ChatMenu = () => {

  return (
    <Button variant="ghost" size="icon" asChild>
        <Link to="/chats">
            <MessageSquare className="h-5 w-5" />
        </Link>
    </Button>
  );
};

export default ChatMenu;
