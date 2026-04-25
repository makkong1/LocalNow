import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import TravelerScreen from '../screens/TravelerScreen';
import GuideScreen from '../screens/GuideScreen';
import ChatScreen from '../screens/ChatScreen';

export type AppTabParamList = {
  Traveler: undefined;
  Guide: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Chat: { roomId: number };
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createStackNavigator<AppStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Traveler" component={TravelerScreen} />
      <Tab.Screen name="Guide" component={GuideScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
