import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TravelerScreen from '../screens/TravelerScreen';
import GuideScreen from '../screens/GuideScreen';
import ChatScreen from '../screens/ChatScreen';
import { useAuth } from '../hooks/useAuth';

export type AppTabParamList = {
  Traveler: undefined;
  Guide: undefined;
  Chat: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

function AppHeader() {
  const { userId, role, logout } = useAuth();
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>LocalNow</Text>
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

export default function AppNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
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
        <Tab.Screen name="Chat" component={ChatScreen} />
      </Tab.Navigator>
    </View>
  );
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
  logo: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 16,
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
});
