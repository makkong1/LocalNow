import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

export default function RootNavigator() {
  const { isLoading, isLoggedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return isLoggedIn ? <AppNavigator /> : <AuthNavigator />;
}
