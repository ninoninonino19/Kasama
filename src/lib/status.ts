import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import type { BillStatus } from '../api/bills';
import type { BadgeTone } from '../components/ui/Chip';

type StatusPresentation = {
  label: string;
  tone: BadgeTone;
  icon: ComponentProps<typeof Ionicons>['name'];
};

/**
 * How each bill state is spoken and drawn. Every entry pairs its colour with a
 * word and a glyph, so nothing about a bill's state is carried by hue alone.
 */
export const BILL_STATUS: Record<BillStatus, StatusPresentation> = {
  settled: { label: 'Settled', tone: 'success', icon: 'checkmark-circle' },
  overdue: { label: 'Overdue', tone: 'danger', icon: 'alert-circle' },
  'due-soon': { label: 'Due soon', tone: 'warning', icon: 'time' },
  open: { label: 'Unpaid', tone: 'neutral', icon: 'ellipse-outline' },
};

export const CHORE_STATUS = {
  done: { label: 'Done', tone: 'success', icon: 'checkmark-circle' },
  overdue: { label: 'Overdue', tone: 'danger', icon: 'alert-circle' },
  today: { label: 'Today', tone: 'warning', icon: 'time' },
} satisfies Record<string, StatusPresentation>;
