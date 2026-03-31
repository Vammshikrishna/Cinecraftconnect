import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, X, Plus, Globe, MapPin, Mail, Phone, Calendar, Users } from 'lucide-react';
import { useCreateCompanyPage } from '@/hooks/useCompanyPages';
import { PAGE_INDUSTRIES, COMPANY_SIZES } from '@/types/companyPages';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CreatePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePageModal({ open, onOpenChange, onSuccess }: CreatePageModalProps) {
  const { user } = useAuth();
  const createPage = useCreateCompanyPage();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [step, setStep] = useState(1);

  const resetForm = () => {
    setName('');
    setTagline('');
    setDescription('');
    setSelectedIndustries([]);
    setCompanySize('');
    setFoundedYear('');
    setHeadquarters('');
    setWebsite('');
    setEmail('');
    setPhone('');
    setSpecialtyInput('');
    setSpecialties([]);
    setLogo(null);
    setLogoPreview('');
    setStep(1);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogo(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logo || !user) return null;
    const ext = logo.name.split('.').pop();
    const fileName = `pages/${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(fileName, logo);
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return publicUrl;
  };

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
  };

  const addSpecialty = () => {
    const trimmed = specialtyInput.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties(prev => [...prev, trimmed]);
      setSpecialtyInput('');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const logoUrl = await uploadLogo();
    await createPage.mutateAsync({
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      logo_url: logoUrl,
      industry: selectedIndustries,
      company_size: companySize || null,
      founded_year: foundedYear ? parseInt(foundedYear) : null,
      headquarters: headquarters.trim() || null,
      website: website.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      specialties,
    });
    resetForm();
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            {step === 1 ? 'Create Your Page' : 'Page Details'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-6 py-2">
            {/* Logo Upload */}
            <div className="flex items-center gap-6">
              <div>
                {logoPreview ? (
                  <div className="relative w-24 h-24">
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-xl border-2 border-border" />
                    <button
                      onClick={() => { setLogo(null); setLogoPreview(''); }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <Building2 size={28} className="text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground">Add Logo</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoSelect} />
                  </label>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Label htmlFor="pageName">Page Name *</Label>
                  <Input
                    id="pageName"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Dharma Productions"
                    className="bg-muted/50 border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="e.g., Creating cinema that moves souls"
                    className="bg-muted/50 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">About</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell us about your organization..."
                rows={4}
                className="bg-muted/50 border-border"
              />
            </div>

            {/* Industry */}
            <div>
              <Label className="mb-2 block">Industry (select all that apply)</Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
                {PAGE_INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndustry(ind)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedIndustries.includes(ind)
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!name.trim()} className="gap-2">
                Next
                <span>→</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Company Size & Founded */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" /> Company Size
                </Label>
                <Select value={companySize} onValueChange={setCompanySize}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map(size => (
                      <SelectItem key={size} value={size}>{size} employees</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="foundedYear" className="flex items-center gap-1.5 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Founded Year
                </Label>
                <Input
                  id="foundedYear"
                  type="number"
                  value={foundedYear}
                  onChange={e => setFoundedYear(e.target.value)}
                  placeholder="e.g., 2015"
                  min={1900}
                  max={new Date().getFullYear()}
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            {/* Headquarters & Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hq" className="flex items-center gap-1.5 mb-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Headquarters
                </Label>
                <Input
                  id="hq"
                  value={headquarters}
                  onChange={e => setHeadquarters(e.target.value)}
                  placeholder="e.g., Mumbai, India"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="website" className="flex items-center gap-1.5 mb-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
                </Label>
                <Input
                  id="website"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pageEmail" className="flex items-center gap-1.5 mb-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                </Label>
                <Input
                  id="pageEmail"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div>
                <Label htmlFor="pagePhone" className="flex items-center gap-1.5 mb-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
                </Label>
                <Input
                  id="pagePhone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            {/* Specialties */}
            <div>
              <Label className="mb-1.5 block">Specialties</Label>
              <div className="flex gap-2">
                <Input
                  value={specialtyInput}
                  onChange={e => setSpecialtyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                  placeholder="e.g., Feature Films (press Enter)"
                  className="bg-muted/50 border-border"
                />
                <Button type="button" variant="outline" size="icon" onClick={addSpecialty}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {specialties.map((s, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {s}
                      <button onClick={() => setSpecialties(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || createPage.isPending}
                className="gap-2"
              >
                {createPage.isPending ? 'Creating...' : 'Create Page'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
