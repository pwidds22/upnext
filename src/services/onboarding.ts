import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@upnext_onboarding_complete';

export const onboardingService = {
  async isComplete(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      return value === 'true';
    } catch {
      // Fail open — don't block users if AsyncStorage fails
      return true;
    }
  },

  async markComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch {
      // Worst case: user sees onboarding again
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    } catch {
      // Ignore
    }
  },
};
