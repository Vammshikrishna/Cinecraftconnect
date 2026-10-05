import { LucideIcon } from 'lucide-react';

export interface TimeRange {
  value: string;
  label: string;
}

export interface StatCardData {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend: 'up' | 'down';
}

export interface ChartData {
  name: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface EngagementData {
  name: string;
  value: number;
  color: string;
}

export interface ChartConfig {
  key: keyof ChartData;
  label: string;
  color: string;
}
