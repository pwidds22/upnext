import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { SyncProvider } from './src/contexts/SyncContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { storageService } from './src/services/storage';
import { COLORS } from './src/utils/constants';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Initialize the database
        await storageService.init();
      } catch (e) {
        console.error('Failed to initialize storage:', e);
        setInitError(e instanceof Error ? e.message : 'Failed to initialize');
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
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Startup Error</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SyncProvider>
          <SubscriptionProvider>
            <AppNavigator />
            <StatusBar style="light" />
          </SubscriptionProvider>
        </SyncProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
});
