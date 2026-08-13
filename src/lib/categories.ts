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

export const BILL_CATEGORIES: CategoryMeta[] = [
  {
    value: 'rent',
    label: 'Rent',
    subtitle: 'Renta / Upa',
    icon: 'home-outline',
    tint: '#1C6A61',
    background: '#D7F2EE',
  },
  {
    value: 'utilities',
    label: 'Utilities',
    subtitle: 'Kuryente at Tubig',
    icon: 'flash-outline',
    tint: '#8A6516',
    background: '#FDF0CE',
  },
  {
    value: 'internet',
    label: 'Internet',
    subtitle: 'WiFi',
    icon: 'wifi-outline',
    tint: '#334D9C',
    background: '#E3E9FB',
  },
  {
    value: 'groceries',
    label: 'Groceries',
    subtitle: 'Palengke / Grocery',
    icon: 'basket-outline',
    tint: '#3B6E33',
    background: '#DFF1DC',
  },
  {
    value: 'other',
    label: 'Other',
    subtitle: 'Iba pa',
    icon: 'ellipsis-horizontal-circle-outline',
    tint: '#B0381D',
    background: '#FFE5DC',
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
