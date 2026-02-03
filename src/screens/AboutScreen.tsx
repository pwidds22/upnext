import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { COLORS } from '../utils/constants';

export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
  };

  const sendEmail = () => {
    Linking.openURL('mailto:support@upnext.app?subject=UpNext%20Support').catch((err) =>
      console.error('Failed to open email:', err)
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App Icon and Version */}
      <View style={styles.header}>
        <View style={styles.appIcon}>
          <Ionicons name="tv" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>UpNext</Text>
        <Text style={styles.version}>Version {appVersion} ({buildNumber})</Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.description}>
          Track your favorite TV shows and movies, discover new content, and share your viewing journey with friends.
        </Text>
      </View>

      {/* Links Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Links</Text>

        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => openLink('https://upnext.app/privacy')}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.text} />
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => openLink('https://upnext.app/terms')}
        >
          <Ionicons name="document-text-outline" size={22} color={COLORS.text} />
          <Text style={styles.linkText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkItem} onPress={sendEmail}>
          <Ionicons name="mail-outline" size={22} color={COLORS.text} />
          <Text style={styles.linkText}>Contact Support</Text>
          <Ionicons name="open-outline" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Credits Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credits</Text>

        <View style={styles.creditItem}>
          <Text style={styles.creditLabel}>Data provided by</Text>
          <TouchableOpacity onPress={() => openLink('https://www.themoviedb.org/')}>
            <Text style={styles.creditValue}>TMDB (The Movie Database)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.creditItem}>
          <Text style={styles.creditLabel}>Icons by</Text>
          <TouchableOpacity onPress={() => openLink('https://ionic.io/ionicons')}>
            <Text style={styles.creditValue}>Ionicons</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with love for TV enthusiasts</Text>
        <Text style={styles.copyright}>2026 UpNext. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  descriptionContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  creditItem: {
    paddingVertical: 10,
  },
  creditLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  creditValue: {
    fontSize: 15,
    color: COLORS.primary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
