import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, MainTabParamList } from '../types';
import { COLORS } from '../utils/constants';

// Screens
import UpNextScreen from '../screens/UpNextScreen';
import MyShowsScreen from '../screens/MyShowsScreen';
import SearchScreen from '../screens/SearchScreen';
import ShowDetailScreen from '../screens/ShowDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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

function MainTabs() {
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
