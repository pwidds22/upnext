import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TMDBShow, FriendsWatchingShow } from '../types';
import ShowPoster from './ShowPoster';
import { COLORS } from '../utils/constants';

interface FriendsWatchingCardProps {
  show: FriendsWatchingShow;
  onPress: (show: TMDBShow) => void;
}

export default function FriendsWatchingCard({ show, onPress }: FriendsWatchingCardProps) {
  // Convert to TMDBShow format for onPress
  const handlePress = () => {
    const tmdbShow: TMDBShow = {
      id: show.tmdbId,
      name: show.title,
      poster_path: show.posterPath,
      backdrop_path: null,
      overview: null,
      first_air_date: null,
      number_of_seasons: null,
      number_of_episodes: null,
      status: null,
    };
    onPress(tmdbShow);
  };

  // Show up to 3 friend avatars
  const displayedFriends = show.friends.slice(0, 3);
  const remainingCount = show.friendCount - displayedFriends.length;

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <ShowPoster path={show.posterPath} size="small" width={100} height={150} />
      <Text style={styles.title} numberOfLines={2}>
        {show.title}
      </Text>
      <View style={styles.friendsRow}>
        <View style={styles.avatarsContainer}>
          {displayedFriends.map((friend, index) => (
            <View
              key={friend.id}
              style={[
                styles.avatar,
                { marginLeft: index === 0 ? 0 : -8, zIndex: 3 - index },
              ]}
            >
              <Text style={styles.avatarText}>
                {(friend.username?.[0] || friend.displayName?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          ))}
          {remainingCount > 0 && (
            <View style={[styles.avatar, styles.moreAvatar, { marginLeft: -8, zIndex: 0 }]}>
              <Text style={styles.moreText}>+{remainingCount}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.friendCount}>
        {show.friendCount === 1 ? '1 friend' : `${show.friendCount} friends`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 8,
  },
  friendsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  moreAvatar: {
    backgroundColor: COLORS.border,
  },
  moreText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  friendCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
