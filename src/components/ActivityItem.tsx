import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityItem as ActivityItemType, REACTION_CONFIG } from '../types';
import { activityService } from '../services/supabase/activity';
import ShowPoster from './ShowPoster';
import { COLORS } from '../utils/constants';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ActivityItemProps {
  activity: ActivityItemType;
  onShowPress: (tmdbId: number, title: string, posterPath: string | null) => void;
  onMoviePress?: (tmdbId: number, title: string, posterPath: string | null) => void;
  onUserPress: (userId: string) => void;
  // If true, this is a nested activity item (inside user dropdown) - don't show user dropdown again
  isNested?: boolean;
}

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getActivityIcon(type: ActivityItemType['type']): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'episode_watch':
      return { name: 'play-circle', color: COLORS.primary };
    case 'show_add':
      return { name: 'checkmark-circle', color: '#34C759' };
    case 'movie_watch':
      return { name: 'film', color: '#9B59B6' };
    case 'rating':
      return { name: 'star', color: '#FFD700' };
    case 'reaction':
      return { name: 'heart', color: '#FF3B30' };
    default:
      return { name: 'ellipse', color: COLORS.textSecondary };
  }
}

function getActivityDescription(activity: ActivityItemType): string {
  switch (activity.type) {
    case 'episode_watch':
      if (activity.isAggregated && activity.episodeCount) {
        if (activity.seasonCompleted) {
          return `finished Season ${activity.seasonCompleted}`;
        } else {
          return `watched ${activity.episodeCount} episodes`;
        }
      } else {
        let desc = `watched S${activity.seasonNumber}E${activity.episodeNumber}`;
        if (activity.episodeTitle) {
          desc += ` "${activity.episodeTitle}"`;
        }
        return desc;
      }
    case 'show_add':
      return 'completed';
    case 'movie_watch':
      return 'watched';
    case 'rating':
      const stars = ((activity.rating ?? 0) / 2).toFixed(1);
      if (activity.ratingType === 'season' && activity.seasonNumber) {
        return `rated Season ${activity.seasonNumber} ${stars} stars`;
      } else if (activity.ratingType === 'episode' && activity.seasonNumber && activity.episodeNumber) {
        return `rated S${activity.seasonNumber}E${activity.episodeNumber} ${stars} stars`;
      } else if (activity.ratingType === 'movie') {
        return `rated ${stars} stars`;
      } else {
        return `rated ${stars} stars`;
      }
    case 'reaction':
      const reactionEmoji = REACTION_CONFIG[activity.reaction!].emoji;
      return `reacted ${reactionEmoji} to S${activity.seasonNumber}E${activity.episodeNumber}`;
    default:
      return '';
  }
}

export default function ActivityItem({ activity, onShowPress, onMoviePress, onUserPress, isNested = false }: ActivityItemProps) {
  const [episodesExpanded, setEpisodesExpanded] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const [userActivity, setUserActivity] = useState<ActivityItemType[]>([]);
  const [loadingUserActivity, setLoadingUserActivity] = useState(false);

  const icon = getActivityIcon(activity.type);
  const username = activity.user.displayName || activity.user.username || 'User';
  const description = getActivityDescription(activity);

  // Handle press on show/movie - route to appropriate handler based on media type
  const handleMediaPress = () => {
    if (activity.mediaType === 'movie' && onMoviePress) {
      onMoviePress(activity.tmdbId, activity.showTitle, activity.posterPath);
    } else {
      onShowPress(activity.tmdbId, activity.showTitle, activity.posterPath);
    }
  };

  const toggleEpisodesExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEpisodesExpanded(!episodesExpanded);
  };

  const toggleUserExpanded = async () => {
    if (isNested) {
      // Nested items just navigate to profile
      onUserPress(activity.userId);
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (!userExpanded && userActivity.length === 0) {
      // Fetch user's recent activity
      setLoadingUserActivity(true);
      try {
        const activities = await activityService.getUserRecentActivity(activity.userId, 5);
        // Filter out the current activity
        const filtered = activities.filter((a) => a.id !== activity.id);
        setUserActivity(filtered);
      } catch (e) {
        console.error('Failed to fetch user activity:', e);
        Alert.alert('Error', 'Failed to load user activity');
      } finally {
        setLoadingUserActivity(false);
      }
    }

    setUserExpanded(!userExpanded);
  };

  const isEpisodesExpandable = activity.isAggregated && activity.episodes && activity.episodes.length > 1;

  return (
    <View style={[styles.container, isNested && styles.nestedContainer]}>
      {/* User avatar */}
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={toggleUserExpanded}
      >
        <View style={[styles.avatar, isNested && styles.nestedAvatar]}>
          <Text style={[styles.avatarText, isNested && styles.nestedAvatarText]}>
            {(activity.user.username?.[0] || activity.user.displayName?.[0] || 'U').toUpperCase()}
          </Text>
        </View>
        {!isNested && (
          <View style={styles.iconBadge}>
            <Ionicons name={icon.name} size={12} color={icon.color} />
          </View>
        )}
      </TouchableOpacity>

      {/* Activity content */}
      <View style={styles.content}>
        <TouchableOpacity
          onPress={isEpisodesExpandable ? toggleEpisodesExpanded : undefined}
          activeOpacity={isEpisodesExpandable ? 0.7 : 1}
        >
          <View style={styles.descriptionRow}>
            <Text style={[styles.activityText, isNested && styles.nestedActivityText]} numberOfLines={episodesExpanded ? undefined : 2}>
              <Text
                style={styles.username}
                onPress={toggleUserExpanded}
              >
                {username}
              </Text>
              {' '}
              {description}
            </Text>
            {isEpisodesExpandable && (
              <Ionicons
                name={episodesExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
                style={styles.expandIcon}
              />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.showRow}
          onPress={handleMediaPress}
        >
          <Text style={[styles.showTitle, isNested && styles.nestedShowTitle]} numberOfLines={1}>
            {activity.showTitle}
          </Text>
        </TouchableOpacity>

        {/* Expanded episode list */}
        {episodesExpanded && activity.episodes && (
          <View style={styles.episodeList}>
            {activity.episodes.map((ep, index) => (
              <Text key={index} style={styles.episodeItem}>
                S{ep.seasonNumber}E{ep.episodeNumber}
                {ep.episodeTitle ? ` - ${ep.episodeTitle}` : ''}
              </Text>
            ))}
          </View>
        )}

        {/* User activity dropdown */}
        {userExpanded && !isNested && (
          <View style={styles.userActivityDropdown}>
            {loadingUserActivity ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.loadingIndicator} />
            ) : userActivity.length > 0 ? (
              <>
                <Text style={styles.moreActivityLabel}>More from {username}</Text>
                {userActivity.map((act) => (
                  <View key={act.id} style={styles.nestedActivityItem}>
                    <Ionicons
                      name={getActivityIcon(act.type).name}
                      size={14}
                      color={getActivityIcon(act.type).color}
                      style={styles.nestedIcon}
                    />
                    <View style={styles.nestedContent}>
                      <Text style={styles.nestedDescription} numberOfLines={1}>
                        {getActivityDescription(act)}
                      </Text>
                      <Text style={styles.nestedShowTitle}>{act.showTitle}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.noMoreActivity}>No other recent activity</Text>
            )}
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() => onUserPress(activity.userId)}
            >
              <Text style={styles.viewProfileText}>View Profile</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.timestamp, isNested && styles.nestedTimestamp]}>{getRelativeTime(activity.timestamp)}</Text>
      </View>

      {/* Show/Movie poster */}
      {!isNested && (
        <TouchableOpacity onPress={handleMediaPress}>
          <ShowPoster path={activity.posterPath} size="small" width={40} height={60} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  nestedContainer: {
    padding: 8,
    paddingLeft: 0,
    borderBottomWidth: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nestedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nestedAvatarText: {
    fontSize: 12,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  content: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    flex: 1,
  },
  nestedActivityText: {
    fontSize: 13,
  },
  username: {
    fontWeight: '600',
  },
  expandIcon: {
    marginLeft: 4,
    marginTop: 2,
  },
  showRow: {
    marginTop: 2,
  },
  showTitle: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  nestedShowTitle: {
    fontSize: 12,
  },
  episodeList: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  episodeItem: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingVertical: 2,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  nestedTimestamp: {
    fontSize: 11,
    marginTop: 2,
  },
  // User activity dropdown styles
  userActivityDropdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loadingIndicator: {
    padding: 8,
  },
  moreActivityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  noMoreActivity: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  nestedActivityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  nestedIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  nestedContent: {
    flex: 1,
  },
  nestedDescription: {
    fontSize: 13,
    color: COLORS.text,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
  },
  viewProfileText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    marginRight: 4,
  },
});
