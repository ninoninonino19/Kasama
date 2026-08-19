import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import type { BillCategory, BillRecurrence, ChoreRecurrence } from './database.types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type CategoryMeta = {
  value: BillCategory;
  label: string;
  /** Everyday Filipino name for the category — shown as a subtitle. */
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
    subtitle: 'Renta / Upa',
    icon: 'home-outline',
    tint: '#33502C',
    background: '#DCE7D4',
  },
  {
    value: 'utilities',
    label: 'Utilities',
    subtitle: 'Kuryente at Tubig',
    icon: 'flash-outline',
    tint: '#7A5B12',
    background: '#F6E4C8',
  },
  {
    value: 'internet',
    label: 'Internet',
    subtitle: 'WiFi',
    icon: 'wifi-outline',
    tint: '#2F4B50',
    background: '#D9E2E4',
  },
  {
    value: 'groceries',
    label: 'Groceries',
    subtitle: 'Palengke / Grocery',
    icon: 'basket-outline',
    tint: '#4A5334',
    background: '#E3E6D6',
  },
  {
    value: 'other',
    label: 'Other',
    subtitle: 'Iba pa',
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

/** Placeholder chores that read like a real boarding-house list. */
export const CHORE_SUGGESTIONS = [
  'Hugas plato',
  'Walis at trapo',
  'Labada',
  'Linis CR',
  'Tapon ng basura',
  'Igib ng tubig',
];

export const BILL_SUGGESTIONS = [
  { title: 'Kuryente', category: 'utilities' as BillCategory },
  { title: 'Tubig', category: 'utilities' as BillCategory },
  { title: 'WiFi', category: 'internet' as BillCategory },
  { title: 'Renta', category: 'rent' as BillCategory },
  { title: 'Grocery', category: 'groceries' as BillCategory },
];
