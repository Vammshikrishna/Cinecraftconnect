import { useState, useEffect } from 'react';
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
    LOCATION_CATEGORIES,
    MarketplaceListing,
    EquipmentCondition
} from '@/types/marketplace';
import { Camera, Home, Upload, X, Package } from 'lucide-react';

interface ListingCreationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialData?: any;
    mode?: 'create' | 'edit';
}

export const ListingCreationModal = ({
    open,
    onOpenChange,
    onSuccess,
    initialData,
    mode = 'create'
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

    // Bundle state
    const [selectedBundleItems, setSelectedBundleItems] = useState<string[]>([]);
    const [userEquipment, setUserEquipment] = useState<MarketplaceListing[]>([]);

    // Condition state
    const [conditionGrade, setConditionGrade] = useState<EquipmentCondition | ''>('');
    const [conditionChecklist, setConditionChecklist] = useState({
        scratches: false,
        functional: false,
        accurate: false
    });
    const [isFlagged, setIsFlagged] = useState(false);

    // Image handling
    // We mix existing URLs and new Files into a unified view for the UI, but store them separately for logic
    const [existingImages, setExistingImages] = useState<string[]>([]); // URLs
    const [newImages, setNewImages] = useState<File[]>([]); // Files
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]); // Data URLs for new files

    useEffect(() => {
        if (open && mode === 'edit' && initialData) {
            setListingType(initialData.listing_type);
            setTitle(initialData.title);
            setDescription(initialData.description);
            setCategory(initialData.category);
            setLocation(initialData.location);
            setPricePerDay(initialData.price_per_day?.toString() || '');
            setPricePerWeek(initialData.price_per_week?.toString() || '');
            setSpecifications(initialData.specifications || {});
            setExistingImages(initialData.images || []);
            setNewImages([]);
            setNewImagePreviews([]);
            
            setIsFlagged(initialData.admin_flagged || false);
            if (initialData.admin_flagged) {
                // Force re-confirmation
                setConditionGrade('');
                setConditionChecklist({ scratches: false, functional: false, accurate: false });
            } else {
                setConditionGrade(initialData.condition_grade || '');
                if (initialData.condition_grade) {
                    setConditionChecklist({ scratches: true, functional: true, accurate: true });
                }
            }
            setStep(1); // Start at step 1 or maybe step 2? keep 1 to allow type change if needed (though usually type is fixed)
        } else if (open && mode === 'create') {
            resetForm();
        }
    }, [open, mode, initialData]);

    useEffect(() => {
        if (listingType === 'bundle' && user) {
            const fetchEquipment = async () => {
                const { data } = await supabase
                    .from('marketplace_listings')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('listing_type', 'equipment')
                    .eq('is_active', true);
                if (data) setUserEquipment(data as any);
            };
            fetchEquipment();
        }
    }, [listingType, user]);

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
        setExistingImages([]);
        setNewImages([]);
        setNewImagePreviews([]);
        setConditionGrade('');
        setConditionChecklist({ scratches: false, functional: false, accurate: false });
        setIsFlagged(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalImages = existingImages.length + newImages.length + files.length;

        if (totalImages > 5) {
            toast({
                title: 'Too many images',
                description: 'You can have up to 5 images total',
                variant: 'destructive'
            });
            return;
        }

        setNewImages([...newImages, ...files]);

        // Create previews
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImagePreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index: number) => {
        setNewImages(prev => prev.filter((_, i) => i !== index));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const uploadImages = async (): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        const { uploadFileToSupabase } = await import('@/utils/fileValidation');

        for (const image of newImages) {
            const { url, error: uploadError } = await uploadFileToSupabase(
                image,
                'marketplace-images',
                user?.id || 'unknown',
                { isThumbnail: true }
            );

            if (uploadError || !url) throw new Error(uploadError || 'Failed to upload image');

            uploadedUrls.push(url);
        }

        return uploadedUrls;
    };

    const handleSubmit = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Upload new images
            const newImageUrls = await uploadImages();

            // Combine with existing images
            const finalImages = [...existingImages, ...newImageUrls];

            const listingData = {
                user_id: user.id,
                listing_type: listingType === 'bundle' ? 'equipment' : listingType,
                title,
                description,
                category: listingType === 'bundle' ? 'Bundle' : category,
                location,
                price_per_day: parseFloat(pricePerDay),
                price_per_week: pricePerWeek ? parseFloat(pricePerWeek) : null,
                images: finalImages,
                specifications,
                is_active: true,
                is_bundle: listingType === 'bundle',
                condition_grade: (listingType === 'equipment' || listingType === 'bundle') && conditionGrade ? conditionGrade : null,
                admin_flagged: false // Clear flag on save since they re-confirmed
            };

            let error;
            let newListingId = initialData?.id;
            if (mode === 'edit' && initialData?.id) {
                // Update
                const { error: updateError } = await (supabase as any)
                    .from('marketplace_listings')
                    .update(listingData)
                    .eq('id', initialData.id);
                error = updateError;
            } else {
                // Insert
                const { data: insertedData, error: insertError } = await (supabase as any)
                    .from('marketplace_listings')
                    .insert(listingData)
                    .select('id')
                    .single();
                error = insertError;
                if (insertedData) newListingId = (insertedData as any).id;
            }

            if (error) throw error;

            if (listingType === 'bundle' && newListingId && selectedBundleItems.length > 0) {
                if (mode === 'edit') {
                    await (supabase as any).from('marketplace_bundle_items').delete().eq('bundle_id', newListingId);
                }
                const bundleItemsData = selectedBundleItems.map(itemId => ({
                    bundle_id: newListingId,
                    item_id: itemId
                }));
                await (supabase as any).from('marketplace_bundle_items').insert(bundleItemsData);
            }

            toast({
                title: mode === 'edit' ? 'Listing Updated' : 'Listing Created',
                description: `Your listing has been successfully ${mode === 'edit' ? 'updated' : 'created'}.`
            });

            if (mode === 'create') resetForm();
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error saving listing:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to save listing',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const categories = listingType === 'equipment'
        ? EQUIPMENT_CATEGORIES
        : LOCATION_CATEGORIES;

    // Computed total image count for display
    const totalImageCount = existingImages.length + newImages.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>{mode === 'edit' ? 'Edit Listing' : 'Create New Listing'}</DialogTitle>
                </DialogHeader>

                {/* Step 1: Type Selection */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <Label className="mb-3 block">What would you like to list?</Label>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => setListingType('equipment')}
                                    className={`p-6 rounded-lg border-2 transition-all ${listingType === 'equipment'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                        }`}
                                >
                                    <Camera size={32} className="mx-auto mb-2" />
                                    <div className="font-semibold">Equipment</div>
                                    <div className="text-sm text-muted-foreground">Cameras, lighting, audio, etc.</div>
                                </button>
                                <button
                                    onClick={() => setListingType('location')}
                                    className={`p-6 rounded-lg border-2 transition-all ${listingType === 'location'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                        }`}
                                >
                                    <Home size={32} className="mx-auto mb-2" />
                                    <div className="font-semibold">Location</div>
                                    <div className="text-sm text-muted-foreground">Studios, properties, venues</div>
                                </button>
                                <button
                                    onClick={() => setListingType('bundle')}
                                    className={`p-6 rounded-lg border-2 transition-all ${listingType === 'bundle'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                        }`}
                                >
                                    <Package size={32} className="mx-auto mb-2" />
                                    <div className="font-semibold">Bundle</div>
                                    <div className="text-sm text-muted-foreground">Group your gear together</div>
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

                        {listingType === 'bundle' ? (
                            <div>
                                <Label>Select Items for Bundle *</Label>
                                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-secondary/10">
                                    {userEquipment.length === 0 ? (
                                        <div className="text-sm text-muted-foreground p-2">You don't have any active equipment listings to bundle.</div>
                                    ) : (
                                        userEquipment.map(item => (
                                            <div key={item.id} className="flex items-center space-x-2">
                                                <input 
                                                    type="checkbox" 
                                                    id={`item-${item.id}`}
                                                    checked={selectedBundleItems.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedBundleItems([...selectedBundleItems, item.id]);
                                                        else setSelectedBundleItems(selectedBundleItems.filter(id => id !== item.id));
                                                    }}
                                                    className="rounded border-gray-300"
                                                />
                                                <Label htmlFor={`item-${item.id}`} className="font-normal cursor-pointer flex-1 flex justify-between">
                                                    <span>{item.title}</span>
                                                    <span className="text-muted-foreground">₹{item.price_per_day}/day</span>
                                                </Label>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
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
                        )}

                        <div>
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g., Los Angeles, CA"
                            />
                        </div>
                        {listingType !== 'location' && (
                            <div className="space-y-4 pt-4 border-t border-white/10">
                                <div>
                                    <h3 className="font-semibold text-lg text-foreground mb-1">Condition Grading</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Please evaluate and guarantee the condition of this item.</p>
                                    
                                    {isFlagged && (
                                        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg mb-4 text-sm font-medium">
                                            This listing was flagged by users for poor condition. You must re-evaluate and re-confirm the condition grade to clear the flag.
                                        </div>
                                    )}

                                    <div className="space-y-3 mb-6 bg-secondary/20 p-4 rounded-xl border border-white/5">
                                        <div className="flex items-start space-x-3">
                                            <input 
                                                type="checkbox" 
                                                id="check-scratches"
                                                checked={conditionChecklist.scratches}
                                                onChange={(e) => setConditionChecklist(prev => ({ ...prev, scratches: e.target.checked }))}
                                                className="mt-1 rounded border-gray-300"
                                            />
                                            <Label htmlFor="check-scratches" className="font-normal cursor-pointer leading-tight">
                                                I confirm there are no undeclared scratches, marks, or physical damages on this item.
                                            </Label>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                            <input 
                                                type="checkbox" 
                                                id="check-functional"
                                                checked={conditionChecklist.functional}
                                                onChange={(e) => setConditionChecklist(prev => ({ ...prev, functional: e.target.checked }))}
                                                className="mt-1 rounded border-gray-300"
                                            />
                                            <Label htmlFor="check-functional" className="font-normal cursor-pointer leading-tight">
                                                I confirm the equipment is 100% functional and all features operate as expected.
                                            </Label>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                            <input 
                                                type="checkbox" 
                                                id="check-accurate"
                                                checked={conditionChecklist.accurate}
                                                onChange={(e) => setConditionChecklist(prev => ({ ...prev, accurate: e.target.checked }))}
                                                className="mt-1 rounded border-gray-300"
                                            />
                                            <Label htmlFor="check-accurate" className="font-normal cursor-pointer leading-tight">
                                                I confirm my description accurately reflects the true current state of this item.
                                            </Label>
                                        </div>
                                    </div>

                                    <div className={`${!(conditionChecklist.scratches && conditionChecklist.functional && conditionChecklist.accurate) ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
                                        <Label htmlFor="condition-grade" className="mb-2 block">Select Condition Grade *</Label>
                                        <Select value={conditionGrade} onValueChange={(val: any) => setConditionGrade(val)}>
                                            <SelectTrigger id="condition-grade">
                                                <SelectValue placeholder="Select Grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Mint">Mint - Looks and functions as brand new</SelectItem>
                                                <SelectItem value="Excellent">Excellent - Minor signs of use, fully functional</SelectItem>
                                                <SelectItem value="Good">Good - Noticeable wear, fully functional</SelectItem>
                                                <SelectItem value="Fair">Fair - Heavy wear, functional with notes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!(conditionChecklist.scratches && conditionChecklist.functional && conditionChecklist.accurate) && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Please check all boxes above to assign a condition grade.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(3)}
                                className="flex-1"
                                disabled={
                                    !title || 
                                    !description || 
                                    !location || 
                                    (listingType === 'bundle' ? selectedBundleItems.length === 0 : !category) ||
                                    (listingType !== 'location' && !conditionGrade)
                                }
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Pricing */}
                {step === 3 && (
                    <div className="space-y-4">
                        {listingType === 'bundle' && selectedBundleItems.length > 0 && (
                            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex flex-col gap-2">
                                <div className="text-sm font-semibold flex justify-between">
                                    <span>Total Value of Items:</span>
                                    <span>₹{selectedBundleItems.reduce((sum, id) => {
                                        const item = userEquipment.find(eq => eq.id === id);
                                        return sum + (item?.price_per_day || 0);
                                    }, 0)}/day</span>
                                </div>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs"
                                    onClick={() => {
                                        const total = selectedBundleItems.reduce((sum, id) => {
                                            const item = userEquipment.find(eq => eq.id === id);
                                            return sum + (item?.price_per_day || 0);
                                        }, 0);
                                        setPricePerDay((total * 0.9).toFixed(2));
                                    }}
                                >
                                    Apply 10% Bundle Discount
                                </Button>
                            </div>
                        )}
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
                            <p className="text-sm text-muted-foreground mt-1">
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
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                                    <Upload size={32} className="text-muted-foreground mb-2" />
                                    <span className="text-sm text-muted-foreground">Click to upload images</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageSelect}
                                        disabled={totalImageCount >= 5}
                                    />
                                </label>
                            </div>

                            {/* Image Previews */}
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                {/* Existing Images */}
                                {existingImages.map((url, index) => (
                                    <div key={`existing-${index}`} className="relative aspect-video">
                                        <img
                                            src={url}
                                            alt={`Existing ${index + 1}`}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => removeExistingImage(index)}
                                            className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-1 hover:bg-destructive"
                                        >
                                            <X size={14} />
                                        </button>
                                        <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">Existing</span>
                                    </div>
                                ))}

                                {/* New Images */}
                                {newImagePreviews.map((preview, index) => (
                                    <div key={`new-${index}`} className="relative aspect-video">
                                        <img
                                            src={preview}
                                            alt={`New ${index + 1}`}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => removeNewImage(index)}
                                            className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-1 hover:bg-destructive"
                                        >
                                            <X size={14} />
                                        </button>
                                        <span className="absolute bottom-1 left-1 bg-green-500/80 text-white text-[10px] px-1 rounded">New</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className="flex-1"
                                disabled={loading || totalImageCount === 0}
                            >
                                {loading ? 'Saving...' : (mode === 'edit' ? 'Update Listing' : 'Create Listing')}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

