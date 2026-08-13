import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { useSessionStore } from '../../src/store/useSessionStore';

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
        tabBarActiveTintColor: '#218578',
        tabBarInactiveTintColor: '#A99B89',
        // Height and bottom inset are left to react-navigation, which already
        // accounts for the home indicator on both platforms.
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#EFE9E1' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: '#FCFAF7' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chores"
        options={{
          title: 'Chores',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
