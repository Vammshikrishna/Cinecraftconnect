import { useState } from 'react';
import { useCompanyPages } from '@/hooks/useCompanyPages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Building2, Plus, TrendingUp, Filter } from 'lucide-react';
import { CompanyPageCard } from '@/components/pages/CompanyPageCard';
import { CreatePageModal } from '@/components/pages/CreatePageModal';
import { PageSkeleton } from '@/components/ui/enhanced-skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { motion } from 'framer-motion';
import { useAccountType } from '@/hooks/useAccountType';
import StudioPageIcon from '@/components/icons/StudioPageIcon';
import { useAppRole } from '@/hooks/useAppRole';

const CompanyPages = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: pages = [], isLoading } = useCompanyPages(searchQuery);
  const { isStudio } = useAccountType();
  const { isInternal } = useAppRole();

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
        <PageHeader 
          title="Companies" 
          subtitle="Explore film studios, production houses, and equipment rentals" 
          Icon={Building2}
          actionsAtTop={true}
          actions={
            (isStudio && !isInternal) && (
                <Button onClick={() => setShowCreateModal(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm">
                  <Plus size={18} strokeWidth={3} />
                  <span className="hidden xs:inline">Create a Page</span>
                  <span className="xs:hidden">Create</span>
                </Button>
            )
          }
        />

        {/* Search Bar using system glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[28px] p-2 md:p-3 mb-12 shadow-sm dark:shadow-none"
        >
          <div className="flex flex-row gap-2 md:gap-3">
            <div className="relative flex-grow h-10 md:h-11">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
              <Input
                placeholder="Search pages by name, location, or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-full bg-background/50 border-transparent focus:bg-muted/30 rounded-2xl text-sm transition-all font-medium placeholder:text-muted-foreground/50"
              />
            </div>
            <Button variant="ghost" className="shrink-0 h-10 md:h-11 gap-2 rounded-2xl border border-border/50 hover:bg-muted/50 font-bold uppercase tracking-widest text-[10px]">
              <Filter size={18} />
              <span>Filters</span>
            </Button>
          </div>
        </motion.div>

        {/* Featured Pages (verified ones) */}
        {!searchQuery && pages.filter(p => p.is_verified).length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-black tracking-tight uppercase">Featured Organizations</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pages
                .filter(p => p.is_verified)
                .slice(0, 4)
                .map(page => (
                  <CompanyPageCard key={page.id} page={page} />
                ))}
            </div>
          </div>
        )}

        {/* All Pages */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <StudioPageIcon size={24} className="text-primary/60" />
            <h2 className="text-2xl font-black tracking-tight uppercase">
              {searchQuery ? `Results for "${searchQuery}"` : 'Industry Directory'}
            </h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <PageSkeleton key={i} />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-24 bg-card/10 border border-border/50 border-dashed rounded-[3rem]">
              <StudioPageIcon size={56} className="mx-auto text-muted-foreground/30 mb-6" />
              <h3 className="text-2xl font-black mb-2">
                {searchQuery ? 'The reel is empty...' : 'No pages yet'}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto font-medium">
                {searchQuery
                  ? 'Try a different search term or explore all pages.'
                  : 'Establish your organization\'s presence in our production ecosystem!'}
              </p>
              {!searchQuery && (isStudio && !isInternal) && (
                <Button onClick={() => setShowCreateModal(true)} className="gap-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-8">
                  <Plus size={20} strokeWidth={3} />
                  Create a Page
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pages.map(page => (
                <CompanyPageCard key={page.id} page={page} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      <CreatePageModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};

export default CompanyPages;
