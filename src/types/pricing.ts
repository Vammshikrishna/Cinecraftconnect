
export type AccountType = 'fan' | 'creator' | 'studio';

export interface PricingBenefit {
  text: string;
  status: 'yes' | 'no' | 'limited' | 'advanced' | 'custom';
}

export interface PricingTier {
  id: AccountType;
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  benefits: Record<string, PricingBenefit>;
  recommended?: boolean;
}

export const PRICING_TIERS: Record<AccountType, PricingTier> = {
  fan: {
    id: 'fan',
    name: 'Fan',
    price: {
      monthly: 0,
      yearly: 0,
    },
    description: 'Goal: acquire millions of fans. They are the product.',
    benefits: {
      'View & engage posts': { text: 'Yes', status: 'yes' },
      'Follow & Rate': { text: 'Yes', status: 'yes' },
      'DM fans': { text: 'Yes', status: 'yes' },
      'DM creators': { text: 'No', status: 'no' },
      'Create posts': { text: 'No', status: 'no' },
      'Discussion Room': { text: 'Public Only', status: 'limited' },
      'Project Space': { text: 'No', status: 'no' },
    },
  },
  creator: {
    id: 'creator',
    name: 'Creator Pro',
    price: {
      monthly: 299,
      yearly: 2499,
    },
    description: 'Priced like Netflix India. Familiar anchor.',
    recommended: true,
    benefits: {
      'All fan features': { text: 'Yes', status: 'yes' },
      'Create & publish posts': { text: 'Yes', status: 'yes' },
      'Discussion Rooms': { text: 'Host All', status: 'yes' },
      'DM everyone': { text: 'Yes', status: 'yes' },
      'Analytics dashboard': { text: 'Basic', status: 'limited' },
      'Portfolio & Project Space': { text: 'Yes', status: 'yes' },
      'Verified badge': { text: 'Yes', status: 'yes' },
      'Company Page': { text: 'Create & Manage', status: 'yes' },
    },
  },
  studio: {
    id: 'studio',
    name: 'Studio / Company',
    price: {
      monthly: 2999,
      yearly: 24999,
    },
    description: 'Film studios, OTT teams, PR agencies pay this.',
    benefits: {
      'Verified company page': { text: 'Yes', status: 'yes' },
      'Post announcements': { text: 'Yes', status: 'yes' },
      'Fan follows page': { text: 'Yes', status: 'yes' },
      'Promoted posts': { text: 'Price Varies', status: 'custom' },
      'Analytics': { text: 'Advanced', status: 'advanced' },
      'API access': { text: 'Yes', status: 'yes' },
    },
  },
};
