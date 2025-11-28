import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { VENDOR_CATEGORIES } from '@/types/marketplace';
import { X, Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface VendorRegistrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const VendorRegistrationModal = ({
    open,
    onOpenChange,
    onSuccess
}: VendorRegistrationModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form state
    const [businessName, setBusinessName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [servicesOffered, setServicesOffered] = useState('');
    const [location, setLocation] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [website, setWebsite] = useState('');
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');

    const resetForm = () => {
        setBusinessName('');
        setDescription('');
        setSelectedCategories([]);
        setServicesOffered('');
        setLocation('');
        setAddress('');
        setPhone('');
        setEmail('');
        setWebsite('');
        setLogo(null);
        setLogoPreview('');
    };

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogo(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const uploadLogo = async (): Promise<string | null> => {
        if (!logo || !user) return null;

        const fileExt = logo.name.split('.').pop();
        const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('vendor-images')
            .upload(fileName, logo);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('vendor-images')
            .getPublicUrl(fileName);

        return publicUrl;
    };

    const handleCategoryToggle = (category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const handleSubmit = async () => {
        if (!user) return;

        if (!businessName || !description || selectedCategories.length === 0 ||
            !location || !phone || !email) {
            toast({
                title: 'Missing Information',
                description: 'Please fill in all required fields',
                variant: 'destructive'
            });
            return;
        }

        try {
            setLoading(true);

            // Upload logo if provided
            const logoUrl = await uploadLogo();

            // Parse services offered
            const services = servicesOffered
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Create vendor profile
            const { error } = await supabase
                .from('vendors')
                .insert({
                    owner_id: user.id,
                    business_name: businessName,
                    description,
                    category: selectedCategories,
                    services_offered: services,
                    location,
                    address: address || null,
                    phone,
                    email,
                    website: website || null,
                    logo_url: logoUrl,
                    is_verified: false
                });

            if (error) throw error;

            resetForm();
            onSuccess();
        } catch (error: any) {
            console.error('Error registering vendor:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to register vendor',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Register Your Business</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Logo Upload */}
                    <div>
                        <Label>Business Logo</Label>
                        <div className="mt-2">
                            {logoPreview ? (
                                <div className="relative w-32 h-32">
                                    <img
                                        src={logoPreview}
                                        alt="Logo preview"
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={() => {
                                            setLogo(null);
                                            setLogoPreview('');
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                                    <Building2 size={32} className="text-gray-400 mb-2" />
                                    <span className="text-xs text-gray-400">Upload Logo</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleLogoSelect}
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Business Name */}
                    <div>
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                            id="businessName"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g., Stellar Post-Production"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your business and services..."
                            rows={4}
                        />
                    </div>

                    {/* Categories */}
                    <div>
                        <Label className="mb-3 block">Service Categories * (Select all that apply)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-700 rounded-lg">
                            {VENDOR_CATEGORIES.map((category) => (
                                <div key={category} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={category}
                                        checked={selectedCategories.includes(category)}
                                        onCheckedChange={() => handleCategoryToggle(category)}
                                    />
                                    <label
                                        htmlFor={category}
                                        className="text-sm cursor-pointer"
                                    >
                                        {category}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Services Offered */}
                    <div>
                        <Label htmlFor="services">Services Offered (comma-separated)</Label>
                        <Input
                            id="services"
                            value={servicesOffered}
                            onChange={(e) => setServicesOffered(e.target.value)}
                            placeholder="e.g., Color Grading, Sound Mixing, VFX"
                        />
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="location">City/State *</Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g., Los Angeles, CA"
                            />
                        </div>
                        <div>
                            <Label htmlFor="address">Full Address (Optional)</Label>
                            <Input
                                id="address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="123 Main St, Suite 100"
                            />
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="phone">Phone *</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="(555) 123-4567"
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contact@business.com"
                            />
                        </div>
                    </div>

                    {/* Website */}
                    <div>
                        <Label htmlFor="website">Website (Optional)</Label>
                        <Input
                            id="website"
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://www.yourbusiness.com"
                        />
                    </div>

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Submitting...' : 'Submit for Verification'}
                    </Button>

                    <p className="text-sm text-gray-400 text-center">
                        Your vendor profile will be reviewed and verified by our team before being published.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
