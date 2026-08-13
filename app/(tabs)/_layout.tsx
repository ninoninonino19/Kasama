import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { haptics } from '../../src/lib/haptics';
import { colors } from '../../src/lib/theme';
import { useSessionStore } from '../../src/store/useSessionStore';

/**
 * Each tab names the icon twice: the filled glyph marks the active tab so the
 * selection doesn't rest on the tint colour alone, which is hard to read for
 * anyone who can't separate teal from warm grey.
 */
const TABS = [
  { name: 'home', title: 'Home', icon: 'home', outline: 'home-outline' },
  { name: 'bills', title: 'Bills', icon: 'receipt', outline: 'receipt-outline' },
  { name: 'chores', title: 'Chores', icon: 'checkmark-done', outline: 'checkmark-done-outline' },
  { name: 'announcements', title: 'Feed', icon: 'megaphone', outline: 'megaphone-outline' },
] as const;

export default function TabsLayout() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useSessionStore((state) => state.household);

  if (status === 'ready' && !session) return <Redirect href="/auth/sign-in" />;
  if (status === 'ready' && !household) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[600],
        // 4.8:1 on the white bar. The old sand tint sat at 2.7:1, so inactive
        // labels were effectively decorative.
        tabBarInactiveTintColor: colors.ink.muted,
        // Height and bottom inset are left to react-navigation, which already
        // accounts for the home indicator on both platforms.
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.sand[200] },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: Platform.OS === 'ios' ? 4 : 0 },
        sceneStyle: { backgroundColor: colors.sand[50] },
      }}
      screenListeners={{
        // A tick under the thumb on every tab change, matching the rest of the
        // app's feedback. `tabPress` fires even when re-selecting the same tab.
        tabPress: () => haptics.select(),
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
