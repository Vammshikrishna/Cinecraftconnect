
import EnhancedNotificationsCenter from "@/components/notifications/EnhancedNotificationsCenter";
import { motion } from "framer-motion";

const Notifications = () => {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[150px]" />
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-16 md:pt-20 relative z-10 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <EnhancedNotificationsCenter />
        </motion.div>
      </main>
    </div>
  );
};

export default Notifications;
