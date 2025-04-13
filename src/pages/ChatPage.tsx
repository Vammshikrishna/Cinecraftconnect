
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ChatPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cinesphere-dark to-black">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-xl p-6">
            <h1 className="text-2xl font-bold mb-6 text-gradient">Chats</h1>
            <p className="text-gray-400">Chat page content will be implemented here.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChatPage;
