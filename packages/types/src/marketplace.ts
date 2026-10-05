export type ListingType = 'equipment' | 'location' | 'bundle';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type EquipmentCondition = 'Mint' | 'Excellent' | 'Good' | 'Fair';

export interface MarketplaceListing {
    id: string;
    user_id: string;
    listing_type: ListingType;
    title: string;
    description: string;
    category: string;
    price_per_day: number;
    price_per_week?: number;
    location: string;
    images: string[];
    specifications: Record<string, any>;
    availability_calendar: Record<string, any>;
    is_active: boolean;
    is_bundle?: boolean;
    bundle_items?: MarketplaceListing[];
    condition_grade?: EquipmentCondition;
    condition_score?: number;
    admin_flagged?: boolean;
    created_at: string;
    updated_at: string;
    profiles?: {
        username: string;
        avatar_url: string;
        full_name: string;
    };
    average_rating?: number;
    review_count?: number;
}

export interface MarketplaceBooking {
    id: string;
    listing_id: string;
    renter_id: string;
    owner_id: string;
    start_date: string;
    end_date: string;
    total_price: number;
    status: BookingStatus;
    message: string;
    created_at: string;
    updated_at: string;
    marketplace_listings?: MarketplaceListing;
    renter_profile?: {
        username: string;
        avatar_url: string;
        full_name: string;
    };
    owner_profile?: {
        username: string;
        avatar_url: string;
        full_name: string;
    };
}

export interface Vendor {
    id: string;
    owner_id: string;
    business_name: string;
    description: string;
    category: string[];
    services_offered: string[];
    location: string;
    address?: string;
    phone: string;
    email: string;
    website?: string;
    logo_url?: string;
    images: string[];
    is_verified: boolean;
    verification_date?: string;
    created_at: string;
    updated_at: string;
    average_rating?: number;
    review_count?: number;
}

export interface VendorService {
    id: string;
    vendor_id: string;
    title: string;
    description: string;
    day_rate: number;
    coverage_area: string;
    min_booking_days: number;
    production_types: string[];
    crew_capacity?: number;
    service_checklist: any[];
    images: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export const PRODUCTION_TYPES = [
    'Feature Film',
    'Commercial',
    'Music Video',
    'TV Series',
    'Short Film',
    'Event',
    'Documentary'
];

export interface MarketplaceReview {
    id: string;
    listing_id?: string;
    vendor_id?: string;
    booking_id?: string;
    reviewer_id: string;
    rating: number;
    condition_rating?: number;
    review_text: string;
    created_at: string;
    profiles?: {
        username: string;
        avatar_url: string;
        full_name: string;
    };
}

// Equipment categories
export const EQUIPMENT_CATEGORIES = [
    'Camera',
    'Lenses',
    'Lighting',
    'Audio',
    'Grip',
    'Stabilization',
    'Monitors',
    'Drones',
    'Accessories',
    'Other Equipment'
] as const;

// Location categories
export const LOCATION_CATEGORIES = [
    'Studio',
    'Outdoor Location',
    'Residential',
    'Commercial',
    'Industrial',
    'Historical',
    'Modern',
    'Warehouse',
    'Office',
    'Other Location'
] as const;

// Vendor categories
export const VENDOR_CATEGORIES = [
    'Post-Production',
    'Sound Design',
    'Color Grading',
    'VFX & Animation',
    'Catering',
    'Equipment Rental',
    'Grip Truck Rental',
    'Transportation',
    'Casting',
    'Location Scouting',
    'Legal Services',
    'Insurance',
    'Accounting',
    'Marketing & Distribution',
    'Other Services'
] as const;

export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];
export type LocationCategory = typeof LOCATION_CATEGORIES[number];
export type VendorCategory = typeof VENDOR_CATEGORIES[number];

export interface MarketplaceWishlist {
    id: string;
    user_id: string;
    listing_id: string;
    created_at: string;
    marketplace_listings?: MarketplaceListing;
}

export interface GearAlert {
    id: string;
    user_id: string;
    category?: string;
    keyword?: string;
    max_price?: number;
    created_at: string;
}
