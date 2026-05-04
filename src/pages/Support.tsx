
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  LifeBuoy,
  MessageCircle,
  Search,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Shield,
  ImageIcon,
  X
} from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  attachment_url?: string;
}

const SupportPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
  const isStaff = isModerator || isAdmin || isSuperAdmin;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [newTicket, setNewTicket] = useState({
    subject: '',
    message: '',
    category: 'general',
    priority: 'medium',
    attachment_url: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('support_tickets')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as SupportTicket[]);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `support-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('support')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('support')
        .getPublicUrl(filePath);

      setNewTicket({ ...newTicket, attachment_url: publicUrl });
      toast({ title: "Attachment Uploaded", description: "Screenshot attached successfully." });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.message) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const { error } = await (supabase as any)
      .from('support_tickets')
      .insert({
        user_id: user?.id,
        subject: newTicket.subject,
        message: newTicket.message,
        category: newTicket.category,
        priority: newTicket.priority,
        attachment_url: newTicket.attachment_url
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create support ticket.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Your support ticket has been submitted. Our team will get back to you soon.",
      });
      setIsCreateOpen(false);
      setNewTicket({ subject: '', message: '', category: 'general', priority: 'medium', attachment_url: '' });
      fetchTickets();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'open': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const faqs = [
    { q: "How do I verify my creator profile?", a: "Go to Settings > Account and look for the 'Submit Verification' button. You'll need to provide ID and supporting documents." },
    { q: "Can I list equipment for rent?", a: "Yes, visit the Marketplace and click 'Post Listing'. You can choose between 'Equipment' and 'Location' categories." },
    { q: "How do I join a Discussion Room?", a: "Browse the 'Rooms' tab on the sidebar. Some rooms are open to everyone, while others require an invitation or specific craft role." }
  ];

  return (
    <div className="min-h-screen bg-background pt-20 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <PageHeader
          title="Support Hub"
          subtitle="How can the CineCraft Team help you today?"
          Icon={LifeBuoy}
          onBack={() => navigate('/settings')}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search for help topics or your tickets..."
                className="pl-10 h-12 rounded-2xl bg-card border-none shadow-sm focus-visible:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Tabs defaultValue="tickets" className="w-full">
              <TabsList className="bg-card p-1 rounded-xl border border-border/50">
                <TabsTrigger value="tickets" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">My Tickets</TabsTrigger>
                <TabsTrigger value="faq" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Common Questions</TabsTrigger>
              </TabsList>

              <TabsContent value="tickets" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    Support History
                  </h3>
                  <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" /> New Ticket
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px] rounded-3xl p-6">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Submit a Request</DialogTitle>
                        <DialogDescription>
                          Our team typically responds within 24 hours.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input
                            id="subject"
                            placeholder="Brief summary of your issue"
                            className="rounded-xl h-11"
                            value={newTicket.subject}
                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                              value={newTicket.category}
                              onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}
                            >
                              <SelectTrigger className="rounded-xl h-11">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General Query</SelectItem>
                                <SelectItem value="technical">Technical Bug</SelectItem>
                                <SelectItem value="billing">Billing/Pro</SelectItem>
                                <SelectItem value="report_abuse">Report Abuse</SelectItem>
                                <SelectItem value="feature_request">Feature Request</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                              value={newTicket.priority}
                              onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                            >
                              <SelectTrigger className="rounded-xl h-11">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="message">Message</Label>
                          <Textarea
                            id="message"
                            placeholder="Describe your issue in detail..."
                            className="rounded-2xl min-h-[120px] resize-none"
                            value={newTicket.message}
                            onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Attachment (Optional)</Label>
                          {newTicket.attachment_url ? (
                            <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-border/50 group">
                              <img src={newTicket.attachment_url} alt="Attachment" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="rounded-full h-8 w-8 p-0"
                                  onClick={() => setNewTicket({ ...newTicket, attachment_url: '' })}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="file"
                                id="attachment"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                              />
                              <label
                                htmlFor="attachment"
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                {isUploading ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Uploading...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                                      <ImageIcon className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Click to upload screenshot</span>
                                    <span className="text-[9px] text-muted-foreground/60 mt-1 uppercase">PNG, JPG up to 5MB</span>
                                  </>
                                )}
                              </label>
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={handleCreateTicket}
                          className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 mt-2"
                        >
                          Submit Ticket
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-card/50 animate-pulse rounded-2xl border border-border/50" />)
                  ) : tickets.length === 0 ? (
                    <Card className="border-dashed border-2 bg-transparent">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <HelpCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <CardTitle className="text-muted-foreground">No tickets yet</CardTitle>
                        <CardDescription className="mt-2">
                          If you have an issue, create a ticket and we'll help you out.
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ) : (
                    tickets.map((ticket) => (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        className="p-4 bg-card rounded-2xl border border-border/50 shadow-sm flex items-center justify-between cursor-pointer group"
                        onClick={() => navigate(`/support/ticket/${ticket.id}`)}
                      >
                        <div className="flex gap-4 items-start">
                          <div className={`p-2 rounded-xl ${ticket.status === 'open' ? 'bg-orange-500/10 text-orange-600' : 'bg-slate-500/10 text-slate-600'}`}>
                            {getStatusIcon(ticket.status)}
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{ticket.subject}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 uppercase font-bold tracking-wider opacity-70">
                                <Clock className="w-3 h-3" />
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </span>
                              <span className="capitalize px-2 py-0.5 rounded-full bg-muted/50">{ticket.category}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </motion.div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="faq" className="mt-6 space-y-4">
                {faqs.map((faq, i) => (
                  <Card key={i} className="rounded-2xl border-none bg-card/50 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        {faq.q}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {faq.a}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {isStaff && (
              <Card className="rounded-3xl border-none bg-gradient-to-br from-primary/10 to-transparent shadow-sm border border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Internal Access
                  </CardTitle>
                  <CardDescription>Administrative Governance Tools</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access deep governance tools to manage tickets and platform health.
                  </p>
                  <Button
                    onClick={() => navigate('/admin')}
                    variant="outline"
                    className="w-full rounded-xl border-primary/30 hover:bg-primary/10 text-primary font-bold shadow-sm"
                  >
                    Admin Dashboard
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="p-6 bg-card rounded-3xl border border-border/50 shadow-sm">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Resources
              </h4>
              <ul className="space-y-3">
                <li className="text-sm flex items-center justify-between group cursor-pointer" onClick={() => navigate('/documentation')}>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">Documentation</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-all" />
                </li>
                <li className="text-sm flex items-center justify-between group cursor-pointer" onClick={() => navigate('/community-guidelines')}>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">Community Guidelines</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-all" />
                </li>
                <li className="text-sm flex items-center justify-between group cursor-pointer" onClick={() => navigate('/safety-center')}>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">Safety Center</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-all" />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
