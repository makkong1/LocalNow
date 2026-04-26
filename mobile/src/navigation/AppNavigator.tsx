import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import TravelerScreen from '../screens/TravelerScreen';
import GuideScreen from '../screens/GuideScreen';
import ChatScreen from '../screens/ChatScreen';
import PaymentScreen from '../screens/PaymentScreen';
import ReviewScreen from '../screens/ReviewScreen';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useMyRequests } from '../hooks/useRequests';

export type AppTabParamList = {
  Traveler: undefined;
  Guide: undefined;
  Chat: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
  ChatRoom: { roomId: number; requestId: number };
  Payment: { requestId: number; guideId: number };
  Review: { requestId: number; guideId: number };
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createStackNavigator<AppStackParamList>();

function RecentChatPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>매칭 확정 후 채팅이 열립니다</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#f59e0b',
        tabBarInactiveTintColor: '#525252',
      }}
    >
      <Tab.Screen name="Traveler" component={TravelerScreen} />
      <Tab.Screen name="Guide" component={GuideScreen} />
      <Tab.Screen name="Chat" component={RecentChatPlaceholder} options={{ title: '채팅' }} />
    </Tab.Navigator>
  );
}

function AppHeader({ isConnected }: { isConnected: boolean }) {
  const { userId, role, logout } = useAuth();
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.logo}>LocalNow</Text>
        <View
          style={[styles.connDot, { backgroundColor: isConnected ? '#22c55e' : '#525252' }]}
        />
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.userInfo}>
          #{userId} · {role}
        </Text>
        <TouchableOpacity onPress={logout} testID="logout-button">
          <Text style={styles.logout}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppContent() {
  const { userId, role } = useAuth();
  const { data: requestsPage } = useMyRequests();

  const activeRequestId = requestsPage?.items.find(
    (r) => r.status === 'OPEN' || r.status === 'MATCHED' || r.status === 'IN_PROGRESS',
  )?.id;

  const { isConnected } = useRealtime({
    userId: userId!,
    role: role!,
    activeRequestId,
  });

  return (
    <View style={{ flex: 1 }}>
      <AppHeader isConnected={isConnected} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ChatRoom" component={ChatScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
      </Stack.Navigator>
    </View>
  );
}

export default function AppNavigator() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 16,
  },
  connDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  logout: {
    color: '#ef4444',
    fontSize: 12,
  },
  tabBar: {
    backgroundColor: '#141414',
    borderTopColor: '#262626',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  placeholderText: {
    color: '#525252',
    fontSize: 14,
  },
});
