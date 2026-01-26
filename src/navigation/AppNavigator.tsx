import React, { useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, MainTabParamList, AuthStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';

// Screens
import UpNextScreen from '../screens/UpNextScreen';
import MyShowsScreen from '../screens/MyShowsScreen';
import SearchScreen from '../screens/SearchScreen';
import ShowDetailScreen from '../screens/ShowDetailScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator({ onComplete }: { onComplete: () => void }) {
  const [screen, setScreen] = useState<'signIn' | 'signUp'>('signIn');

  if (screen === 'signUp') {
    return (
      <SignUpScreen
        onNavigateToSignIn={() => setScreen('signIn')}
        onSkip={onComplete}
      />
    );
  }

  return (
    <SignInScreen
      onNavigateToSignUp={() => setScreen('signUp')}
      onSkip={onComplete}
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
  const { user } = useAuth();

  return (
    <TouchableOpacity
      style={styles.profileButton}
      onPress={() => navigation.navigate('Profile')}
    >
      {user ? (
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user.email?.[0].toUpperCase() || 'U'}
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
          } else if (route.name === 'MyShows') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else {
            iconName = focused ? 'search' : 'search-outline';
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
        name="MyShows"
        component={MyShowsScreen}
        options={{ title: 'My Shows' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
        }}
      >
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
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            presentation: 'modal',
          }}
        />
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
