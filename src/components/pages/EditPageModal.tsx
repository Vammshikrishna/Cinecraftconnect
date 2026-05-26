import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateCompanyPage } from "@/hooks/useCompanyPages";
import { CompanyPage, PAGE_INDUSTRIES as INDUSTRIES, COMPANY_SIZES } from "@/types/companyPages";
import { Building2, Upload, Loader2, Globe, MapPin, Mail } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface EditPageModalProps {
  page: CompanyPage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPageModal({ page, open, onOpenChange }: EditPageModalProps) {
  const updatePage = useUpdateCompanyPage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: page.name,
    tagline: page.tagline || "",
    description: page.description || "",
    industry: page.industry[0] || "",
    company_size: page.company_size || "",
    website: page.website || "",
    headquarters: page.headquarters || "",
    email: page.email || "",
    logo_url: page.logo_url || "",
    cover_image_url: page.cover_image_url || "",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const { compressImage } = await import('@/utils/imageCompression');
      const compressedFile = await compressImage(file);

      const fileExt = compressedFile.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const folder = type === 'logo' ? 'company-logos' : 'company-covers';
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company_assets")
        .upload(filePath, compressedFile, {
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company_assets")
        .getPublicUrl(filePath);

      if (type === 'logo') {
        setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, cover_image_url: publicUrl }));
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'logo');
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'cover');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePage.mutate(
      {
        id: page.id,
        updates: {
          ...formData,
          industry: [formData.industry],
        },
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Page Details</DialogTitle>
          <DialogDescription>
            Update your company's information, logo, and banner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Cover Photo Upload */}
          <div className="space-y-2">
            <Label>Cover Photo</Label>
            <div className="relative group h-32 w-full rounded-xl border-2 border-dashed border-border overflow-hidden hover:border-primary transition-colors">
              {formData.cover_image_url ? (
                <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No cover photo set
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Upload className="h-6 w-6 mr-2" />
                <span>Change Cover</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} disabled={isLoading} />
              </label>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border group-hover:border-primary transition-colors">
                <AvatarImage src={formData.logo_url || undefined} />
                <AvatarFallback>
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Upload className="h-6 w-6" />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isLoading} />
              </label>
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Company Logo</h4>
              <p className="text-xs text-muted-foreground">Recommend 400x400px. PNG or JPG.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Page Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Select
                value={formData.industry}
                onValueChange={value => setFormData(prev => ({ ...prev, industry: value }))}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind: string) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              placeholder="Briefly describe what your company does"
              value={formData.tagline}
              onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About / Description</Label>
            <Textarea
              id="description"
              className="min-h-[120px]"
              placeholder="Tell us more about your company..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_size">Company Size</Label>
              <Select
                value={formData.company_size}
                onValueChange={value => setFormData(prev => ({ ...prev, company_size: value }))}
              >
                <SelectTrigger id="company_size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="website"
                  className="pl-9"
                  placeholder="https://..."
                  value={formData.website}
                  onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="headquarters">Headquarters</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="headquarters"
                  className="pl-9"
                  placeholder="City, Country"
                  value={formData.headquarters}
                  onChange={e => setFormData(prev => ({ ...prev, headquarters: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Public Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="contact@company.com"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePage.isPending || isLoading}>
              {(updatePage.isPending || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
