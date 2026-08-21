import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * When this device last had the board open.
 *
 * Per device and not in the schema on purpose: "have I read this" is a
 * property of the person looking, and the app has no accounts to hang it on —
 * an identity here already lives on one phone. A column would also mean a
 * write on every tab change.
 *
 * It is a store rather than a plain AsyncStorage helper because two things
 * need it at once: the board marks itself seen, and the tab bar has to notice
 * that immediately and drop its dot.
 */
type BoardSeenState = {
  /** ISO timestamp, or null before the stored value has been read back. */
  seenAt: string | null;
  hydrated: boolean;
  hydrate: (householdId: string) => Promise<void>;
  markSeen: (householdId: string) => void;
  reset: () => void;
};

const key = (householdId: string) => `kasama.board.seen.${householdId}`;

export const useBoardSeen = create<BoardSeenState>((set) => ({
  seenAt: null,
  hydrated: false,

  hydrate: async (householdId) => {
    try {
      const stored = await AsyncStorage.getItem(key(householdId));
      if (stored) {
        set({ seenAt: stored, hydrated: true });
        return;
      }
      // Nothing stored yet — a fresh install, or a household that predates
      // this. Start the clock now rather than leaving it null: the alternative
      // is either a dot for every note ever written, or no dot at all until
      // they happen to open the board once.
      const now = new Date().toISOString();
      set({ seenAt: now, hydrated: true });
      await AsyncStorage.setItem(key(householdId), now);
    } catch {
      // A storage read that fails shouldn't pin a dot to the board forever.
      // Treating it as "seen just now" errs towards the quieter mistake.
      set({ seenAt: new Date().toISOString(), hydrated: true });
    }
  },

  markSeen: (householdId) => {
    const seenAt = new Date().toISOString();
    set({ seenAt, hydrated: true });
    // Fire and forget: the store already has the value, and the write only
    // matters for the next cold start.
    void AsyncStorage.setItem(key(householdId), seenAt).catch(() => {});
  },

  reset: () => set({ seenAt: null, hydrated: false }),
}));
