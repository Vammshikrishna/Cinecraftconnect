import { useState } from 'react';
import { useCompanyPages } from '@/hooks/useCompanyPages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Building2, TrendingUp } from 'lucide-react';
import { CompanyPageCard } from '@/components/pages/CompanyPageCard';
import { CreatePageModal } from '@/components/pages/CreatePageModal';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';

const CompanyPages = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: pages = [], isLoading } = useCompanyPages(searchQuery);

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-24">
        {/* Header */}
        <div className="flex flex-col gap-1 mb-8">
          <div className="flex flex-row justify-between items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
              Pages
            </h1>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2 shadow-lg shadow-primary/20 shrink-0 h-9 md:h-11 px-3 md:px-5 text-xs md:text-sm">
              <Plus size={18} />
              <span className="hidden xs:inline">Create a Page</span>
              <span className="xs:hidden">Create</span>
            </Button>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground opacity-90">
            Discover production houses, studios, agencies, and organizations
          </p>
        </div>

        {/* Search */}
        <div className="bg-card border border-border rounded-xl p-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search pages by name, location, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Featured Pages (verified ones) */}
        {!searchQuery && pages.filter(p => p.is_verified).length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Featured Pages</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {searchQuery ? `Results for "${searchQuery}"` : 'All Pages'}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <CardSkeleton key={i} className="h-64" />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-20">
              <Building2 size={56} className="mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery ? 'No pages found' : 'No pages yet'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Be the first to create a company page and establish your organization\'s presence!'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Plus size={18} />
                  Create a Page
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
