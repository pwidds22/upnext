import * as Linking from 'expo-linking';
import { LinkingOptions, getStateFromPath } from '@react-navigation/native';
import { RootStackParamList } from '../types';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'upnext://'],
  config: {
    screens: {
      Main: '',
      // UserProfile handles both userId and username params
      // The screen itself will resolve username to userId
      UserProfile: 'profile/:username',
    },
  },
  // Custom state resolver to handle the username-based routing
  getStateFromPath: (path, options) => {
    // Check for profile/username pattern
    const profileMatch = path.match(/^profile\/([^\/\?]+)/);
    if (profileMatch) {
      const username = decodeURIComponent(profileMatch[1]);
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'UserProfile',
            // Pass username - the screen will resolve to userId
            params: { username },
          },
        ],
      };
    }

    // Fall back to default handling for other paths
    return getStateFromPath(path, options);
  },
};
