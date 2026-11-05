import EnhancedNotificationsCenter from "@/components/notifications/EnhancedNotificationsCenter";

const Notifications = () => {
  return (
    <div className="min-h-dvh bg-background selection:bg-primary/30">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[150px]" />
      </div>

      <main className="max-w-[820px] mx-auto px-4 pt-16 md:pt-20 relative z-10 pb-24">
        <EnhancedNotificationsCenter />
      </main>
    </div>
  );
};

export default Notifications;
