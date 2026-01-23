import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { storageService } from './src/services/storage';
import { COLORS } from './src/utils/constants';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Initialize the database
        await storageService.init();
      } catch (e) {
        console.error('Failed to initialize storage:', e);
      } finally {
        setIsReady(true);
      }
    }

    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
