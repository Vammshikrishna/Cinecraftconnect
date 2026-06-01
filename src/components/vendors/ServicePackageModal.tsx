import { useState } from 'react';
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
import { PRODUCTION_TYPES } from '@/types/marketplace';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ServicePackageModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendorId: string;
    onSuccess: () => void;
}

export const ServicePackageModal = ({
    open,
    onOpenChange,
    vendorId,
    onSuccess
}: ServicePackageModalProps) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dayRate, setDayRate] = useState('');
    const [coverageArea, setCoverageArea] = useState('');
    const [minBookingDays, setMinBookingDays] = useState('1');
    const [selectedProductionTypes, setSelectedProductionTypes] = useState<string[]>([]);
    const [crewCapacity, setCrewCapacity] = useState('');
    const [checklistItems, setChecklistItems] = useState<string[]>([]);
    const [newItem, setNewItem] = useState('');

    const handleProductionTypeToggle = (type: string) => {
        setSelectedProductionTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const addChecklistItem = () => {
        if (newItem.trim()) {
            setChecklistItems([...checklistItems, newItem.trim()]);
            setNewItem('');
        }
    };

    const removeChecklistItem = (index: number) => {
        setChecklistItems(checklistItems.filter((_, i) => i !== index));
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setDayRate('');
        setCoverageArea('');
        setMinBookingDays('1');
        setSelectedProductionTypes([]);
        setCrewCapacity('');
        setChecklistItems([]);
    };

    const handleSubmit = async () => {
        if (!title || !description || !dayRate || !coverageArea || selectedProductionTypes.length === 0) {
            toast({
                title: 'Missing Information',
                description: 'Please fill in all required fields.',
                variant: 'destructive'
            });
            return;
        }

        try {
            setLoading(true);

            const { error } = await supabase
                .from('vendor_services' as any)
                .insert({
                    vendor_id: vendorId,
                    title,
                    description,
                    day_rate: parseFloat(dayRate),
                    coverage_area: coverageArea,
                    min_booking_days: parseInt(minBookingDays) || 1,
                    production_types: selectedProductionTypes,
                    crew_capacity: crewCapacity ? parseInt(crewCapacity) : null,
                    service_checklist: checklistItems,
                    is_active: true
                });

            if (error) throw error;

            toast({ title: 'Success', description: 'Service package created!' });
            resetForm();
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error creating service:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to create service',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetForm();
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>Add Service Package</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Basic Details */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="title">Service Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Gourmet Catering Truck, Makeup Trailer"
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">Description *</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what this service includes..."
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="dayRate">Day Rate (₹) *</Label>
                                <Input
                                    id="dayRate"
                                    type="number"
                                    value={dayRate}
                                    onChange={(e) => setDayRate(e.target.value)}
                                    placeholder="e.g., 15000"
                                    min="0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="coverageArea">Coverage Area *</Label>
                                <Input
                                    id="coverageArea"
                                    value={coverageArea}
                                    onChange={(e) => setCoverageArea(e.target.value)}
                                    placeholder="e.g., Mumbai Metropolitan Region"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="minBooking">Min Booking Days</Label>
                                <Input
                                    id="minBooking"
                                    type="number"
                                    value={minBookingDays}
                                    onChange={(e) => setMinBookingDays(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="crewCapacity">Crew Capacity (Optional)</Label>
                                <Input
                                    id="crewCapacity"
                                    type="number"
                                    value={crewCapacity}
                                    onChange={(e) => setCrewCapacity(e.target.value)}
                                    placeholder="e.g., feeds up to 100 people"
                                    min="1"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Number of people this service supports.</p>
                            </div>
                        </div>
                    </div>

                    {/* Production Types */}
                    <div>
                        <Label className="mb-3 block">Supported Production Types *</Label>
                        <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto p-3 bg-secondary/10 border border-border rounded-lg">
                            {PRODUCTION_TYPES.map((type) => (
                                <div key={type} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={type}
                                        checked={selectedProductionTypes.includes(type)}
                                        onCheckedChange={() => handleProductionTypeToggle(type)}
                                    />
                                    <label htmlFor={type} className="text-sm cursor-pointer">{type}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Checklist */}
                    <div>
                        <Label className="block mb-2">Service Checklist</Label>
                        <p className="text-xs text-muted-foreground mb-3">List exactly what is included in this package.</p>
                        <div className="flex gap-2 mb-3">
                            <Input
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                placeholder="e.g., Includes generator and fuel"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addChecklistItem();
                                    }
                                }}
                            />
                            <Button type="button" onClick={addChecklistItem} variant="secondary">
                                <Plus size={16} />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {checklistItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md border border-border text-sm">
                                    <span>{item}</span>
                                    <button
                                        onClick={() => removeChecklistItem(idx)}
                                        className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {checklistItems.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">No checklist items added.</p>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleSubmit} disabled={loading} className="w-full">
                        {loading ? 'Creating...' : 'Create Service Package'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
