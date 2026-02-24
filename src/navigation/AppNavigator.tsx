import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, MainTabParamList, AuthStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import { linking } from './linking';
import { onboardingService } from '../services/onboarding';
import { storageService } from '../services/storage';

// Screens
import UpNextScreen from '../screens/UpNextScreen';
import MyShowsScreen from '../screens/MyShowsScreen';
import SearchScreen from '../screens/SearchScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import ShowDetailScreen from '../screens/ShowDetailScreen';
import MovieDetailScreen from '../screens/MovieDetailScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserSearchScreen from '../screens/UserSearchScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserListScreen from '../screens/UserListScreen';
import AboutScreen from '../screens/AboutScreen';
import SyncSettingsScreen from '../screens/SyncSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StatsScreen from '../screens/StatsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  const [screen, setScreen] = useState<'signIn' | 'signUp'>('signIn');

  if (screen === 'signUp') {
    return (
      <SignUpScreen
        onNavigateToSignIn={() => setScreen('signIn')}
      />
    );
  }

  return (
    <SignInScreen
      onNavigateToSignUp={() => setScreen('signUp')}
    />
  );
}

// Dark theme
const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.primary,
  },
};

function ProfileButton({ navigation }: { navigation: any }) {
  const { user, profile } = useAuth();

  return (
    <TouchableOpacity
      style={styles.profileButton}
      onPress={() => navigation.navigate('Profile')}
    >
      {user ? (
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {(profile?.displayName?.[0] || profile?.username?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </Text>
        </View>
      ) : (
        <Ionicons name="person-circle-outline" size={28} color={COLORS.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

function MainTabs({ navigation }: { navigation: any }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'UpNext') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else {
            iconName = focused ? 'pulse' : 'pulse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        headerRight: () => <ProfileButton navigation={navigation} />,
      })}
    >
      <Tab.Screen
        name="UpNext"
        component={UpNextScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Library"
        component={MyShowsScreen}
        options={{ title: 'Library' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityFeedScreen}
        options={{ title: 'Activity' }}
      />
    </Tab.Navigator>
  );
}

// Loading fallback for deep links
function LinkingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      // Check AsyncStorage flag first
      const complete = await onboardingService.isComplete();
      if (complete) {
        setIsOnboardingComplete(true);
        return;
      }

      // Existing users updating the app: if they have tracked shows, skip onboarding
      try {
        const shows = await storageService.getAllShows();
        if (shows.length > 0) {
          await onboardingService.markComplete();
          setIsOnboardingComplete(true);
          return;
        }
      } catch {
        // DB not ready — proceed to onboarding
      }

      setIsOnboardingComplete(false);
    }
    checkOnboarding();
  }, []);

  // Show loading while checking onboarding or auth state
  if (isOnboardingComplete === null || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme} linking={linking} fallback={<LinkingFallback />}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
        }}
      >
        {!isOnboardingComplete ? (
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
            {() => <OnboardingScreen onComplete={() => setIsOnboardingComplete(true)} />}
          </Stack.Screen>
        ) : !user ? (
          <Stack.Screen name="Auth" options={{ headerShown: false }}>
            {() => <AuthNavigator />}
          </Stack.Screen>
        ) : (
          <>
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ShowDetail"
          component={ShowDetailScreen}
          options={({ route }) => ({
            title: route.params.show.title,
          })}
        />
        <Stack.Screen
          name="MovieDetail"
          component={MovieDetailScreen}
          options={({ route }) => ({
            title: route.params.movie.title,
          })}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="UserSearch"
          component={UserSearchScreen}
          options={{ title: 'Find People' }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name="Followers"
          component={UserListScreen}
          options={({ route }) => ({
            title: route.params.username
              ? `${route.params.username}'s Followers`
              : 'Followers',
          })}
        />
        <Stack.Screen
          name="Following"
          component={UserListScreen}
          options={({ route }) => ({
            title: route.params.username
              ? `${route.params.username} Following`
              : 'Following',
          })}
        />
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{ title: 'About' }}
        />
        <Stack.Screen
          name="SyncSettings"
          component={SyncSettingsScreen}
          options={{ title: 'Sync Settings' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ title: 'My Stats' }}
        />
        </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  profileButton: {
    marginRight: 16,
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
