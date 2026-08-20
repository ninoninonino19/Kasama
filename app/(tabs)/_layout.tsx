import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { BoardTabBar } from '../../src/components/ui/BoardTabBar';
import { usePushOnboarding } from '../../src/hooks/usePushOnboarding';
import { colors } from '../../src/lib/theme';
import { useSessionStore } from '../../src/store/useSessionStore';

/**
 * Each tab names the icon twice: the filled glyph marks the active tab so the
 * selection doesn't rest on the tint colour alone, which is hard to read for
 * anyone who can't separate moss from warm grey.
 */
const TABS = [
  { name: 'home', title: 'Home', icon: 'home', outline: 'home-outline' },
  { name: 'bills', title: 'Bills', icon: 'receipt', outline: 'receipt-outline' },
  { name: 'chores', title: 'Chores', icon: 'checkmark-done', outline: 'checkmark-done-outline' },
  { name: 'announcements', title: 'Board', icon: 'reader', outline: 'reader-outline' },
] as const;

export default function TabsLayout() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useSessionStore((state) => state.household);

  // First launch into the app proper is where notifications get offered.
  usePushOnboarding();

  if (status === 'ready' && !session) return <Redirect href="/auth/sign-in" />;
  if (status === 'ready' && !household) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      // The rail draws itself — see BoardTabBar for the selected-tab treatment
      // and the haptic tick, which react-navigation's default bar can't express.
      tabBar={(props) => <BoardTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.screenBg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? tab.icon : tab.outline} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
