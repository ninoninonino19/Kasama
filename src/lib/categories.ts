import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import type { BillCategory, BillRecurrence, ChoreRecurrence } from './database.types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type CategoryMeta = {
  value: BillCategory;
  label: string;
  /** What actually falls under this category — shown as a subtitle. */
  subtitle: string;
  icon: IoniconName;
  tint: string;
  background: string;
};

/**
 * Tints are drawn from the same earth range as the avatar palette, so a column
 * of category chips sits inside the fridge-board system instead of importing a
 * second one. Each pairing clears 4.5:1, and the glyph — not the hue — is what
 * actually names the category.
 */
export const BILL_CATEGORIES: CategoryMeta[] = [
  {
    value: 'rent',
    label: 'Rent',
    subtitle: 'Rent and room share',
    icon: 'home-outline',
    tint: '#33502C',
    background: '#DCE7D4',
  },
  {
    value: 'utilities',
    label: 'Utilities',
    subtitle: 'Power and water',
    icon: 'flash-outline',
    tint: '#7A5B12',
    background: '#F6E4C8',
  },
  {
    value: 'internet',
    label: 'Internet',
    subtitle: 'WiFi and data',
    icon: 'wifi-outline',
    tint: '#2F4B50',
    background: '#D9E2E4',
  },
  {
    value: 'groceries',
    label: 'Groceries',
    subtitle: 'Food and household',
    icon: 'basket-outline',
    tint: '#4A5334',
    background: '#E3E6D6',
  },
  {
    value: 'other',
    label: 'Other',
    subtitle: 'Anything else',
    icon: 'ellipsis-horizontal-circle-outline',
    tint: '#8E3D2C',
    background: '#F0DAD3',
  },
];

export function categoryMeta(category: BillCategory): CategoryMeta {
  return BILL_CATEGORIES.find((entry) => entry.value === category) ?? BILL_CATEGORIES[4];
}

export const BILL_RECURRENCES: { value: BillRecurrence; label: string }[] = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const CHORE_RECURRENCES: { value: ChoreRecurrence; label: string }[] = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** Placeholder chores that read like a real shared-house list. */
export const CHORE_SUGGESTIONS = [
  'Wash the dishes',
  'Sweep and mop',
  'Laundry',
  'Clean the bathroom',
  'Take out the bins',
  'Refill the water',
];

export const BILL_SUGGESTIONS = [
  { title: 'Electricity', category: 'utilities' as BillCategory },
  { title: 'Water', category: 'utilities' as BillCategory },
  { title: 'Internet', category: 'internet' as BillCategory },
  { title: 'Rent', category: 'rent' as BillCategory },
  { title: 'Groceries', category: 'groceries' as BillCategory },
];
