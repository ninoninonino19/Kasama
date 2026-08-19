import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import type { BillStatus } from '../api/bills';
import type { PillTone } from '../components/ui/Pill';

type StatusPresentation = {
  label: string;
  tone: PillTone;
  icon: ComponentProps<typeof Ionicons>['name'];
};

/**
 * How each bill state is spoken and drawn. Every entry pairs its colour with a
 * word and a glyph, so nothing about a bill's state is carried by hue alone.
 */
export const BILL_STATUS: Record<BillStatus, StatusPresentation> = {
  settled: { label: 'Paid', tone: 'ok', icon: 'checkmark-circle' },
  overdue: { label: 'Overdue', tone: 'alert', icon: 'alert-circle' },
  'due-soon': { label: 'Due soon', tone: 'warn', icon: 'time' },
  open: { label: 'Pending', tone: 'muted', icon: 'ellipse-outline' },
};

export const CHORE_STATUS = {
  done: { label: 'Done', tone: 'ok', icon: 'checkmark-circle' },
  overdue: { label: 'Overdue', tone: 'alert', icon: 'alert-circle' },
  today: { label: 'Today', tone: 'warn', icon: 'time' },
} satisfies Record<string, StatusPresentation>;
