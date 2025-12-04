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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
    ListingType,
    EQUIPMENT_CATEGORIES,
    LOCATION_CATEGORIES
} from '@/types/marketplace';
import { Camera, Home, Upload, X } from 'lucide-react';

interface ListingCreationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const ListingCreationModal = ({
    open,
    onOpenChange,
    onSuccess
}: ListingCreationModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form state
    const [listingType, setListingType] = useState<ListingType>('equipment');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');
    const [pricePerDay, setPricePerDay] = useState('');
    const [pricePerWeek, setPricePerWeek] = useState('');
    const [specifications, setSpecifications] = useState<Record<string, string>>({});
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    const resetForm = () => {
        setStep(1);
        setListingType('equipment');
        setTitle('');
        setDescription('');
        setCategory('');
        setLocation('');
        setPricePerDay('');
        setPricePerWeek('');
        setSpecifications({});
        setImages([]);
        setImagePreviews([]);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + images.length > 5) {
            toast({
                title: 'Too many images',
                description: 'You can upload up to 5 images',
                variant: 'destructive'
            });
            return;
        }

        setImages([...images, ...files]);

        // Create previews
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
        setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    };

    const uploadImages = async (): Promise<string[]> => {
        const uploadedUrls: string[] = [];

        for (const image of images) {
            const fileExt = image.name.split('.').pop();
            const fileName = `${user?.id}/${Date.now()}-${Math.random()}.${fileExt}`;

            const { error } = await supabase.storage
                .from('marketplace-images')
                .upload(fileName, image);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('marketplace-images')
                .getPublicUrl(fileName);

            uploadedUrls.push(publicUrl);
        }

        return uploadedUrls;
    };

    const handleSubmit = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Upload images
            const imageUrls = await uploadImages();

            // Create listing
            const { error } = await supabase
                .from('marketplace_listings')
                .insert({
                    user_id: user.id,
                    listing_type: listingType,
                    title,
                    description,
                    category,
                    location,
                    price_per_day: parseFloat(pricePerDay),
                    price_per_week: pricePerWeek ? parseFloat(pricePerWeek) : null,
                    images: imageUrls,
                    specifications,
                    is_active: true
                });

            if (error) throw error;

            resetForm();
            onSuccess();
        } catch (error: any) {
            console.error('Error creating listing:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to create listing',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const categories = listingType === 'equipment'
        ? EQUIPMENT_CATEGORIES
        : LOCATION_CATEGORIES;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Listing</DialogTitle>
                </DialogHeader>

                {/* Step 1: Type Selection */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <Label className="mb-3 block">What would you like to list?</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setListingType('equipment')}
                                    className={`p-6 rounded-lg border-2 transition-all ${listingType === 'equipment'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <Camera size={32} className="mx-auto mb-2" />
                                    <div className="font-semibold">Equipment</div>
                                    <div className="text-sm text-gray-400">Cameras, lighting, audio, etc.</div>
                                </button>
                                <button
                                    onClick={() => setListingType('location')}
                                    className={`p-6 rounded-lg border-2 transition-all ${listingType === 'location'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <Home size={32} className="mx-auto mb-2" />
                                    <div className="font-semibold">Location</div>
                                    <div className="text-sm text-gray-400">Studios, properties, venues</div>
                                </button>
                            </div>
                        </div>
                        <Button onClick={() => setStep(2)} className="w-full">
                            Continue
                        </Button>
                    </div>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Arri Alexa Mini LF Camera Package"
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">Description *</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your listing in detail..."
                                rows={4}
                            />
                        </div>

                        <div>
                            <Label htmlFor="category">Category *</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g., Los Angeles, CA"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(3)}
                                className="flex-1"
                                disabled={!title || !description || !category || !location}
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Pricing */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="pricePerDay">Price per Day (₹) *</Label>
                            <Input
                                id="pricePerDay"
                                type="number"
                                value={pricePerDay}
                                onChange={(e) => setPricePerDay(e.target.value)}
                                placeholder="1500"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div>
                            <Label htmlFor="pricePerWeek">Price per Week (₹) (Optional)</Label>
                            <Input
                                id="pricePerWeek"
                                type="number"
                                value={pricePerWeek}
                                onChange={(e) => setPricePerWeek(e.target.value)}
                                placeholder="9000"
                                min="0"
                                step="0.01"
                            />
                            <p className="text-sm text-gray-400 mt-1">
                                Offer a discounted weekly rate
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(4)}
                                className="flex-1"
                                disabled={!pricePerDay}
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Images */}
                {step === 4 && (
                    <div className="space-y-4">
                        <div>
                            <Label>Images (up to 5)</Label>
                            <div className="mt-2">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                                    <Upload size={32} className="text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-400">Click to upload images</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageSelect}
                                        disabled={images.length >= 5}
                                    />
                                </label>
                            </div>

                            {/* Image Previews */}
                            {imagePreviews.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative aspect-video">
                                            <img
                                                src={preview}
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                            <button
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className="flex-1"
                                disabled={loading || images.length === 0}
                            >
                                {loading ? 'Creating...' : 'Create Listing'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
