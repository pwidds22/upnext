import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';
import { ReactionsSummary as ReactionsSummaryType } from '../../types';
import StatCard from './StatCard';
import SegmentedBar from './SegmentedBar';

interface ReactionsSummaryProps {
  reactions: ReactionsSummaryType;
}

const REACTION_EMOJI: Record<string, string> = {
  good: '\u{1F44D}',
  meh: '\u{1F610}',
  bad: '\u{1F44E}',
};

function formatEpCode(season: number, episode: number): string {
  return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
}

export default function ReactionsSummary({ reactions }: ReactionsSummaryProps) {
  const pctGood = reactions.total > 0 ? Math.round((reactions.good / reactions.total) * 100) : 0;
  const pctMeh = reactions.total > 0 ? Math.round((reactions.meh / reactions.total) * 100) : 0;
  const pctBad = reactions.total > 0 ? Math.round((reactions.bad / reactions.total) * 100) : 0;

  const segments = [
    { value: reactions.good, color: COLORS.primary },
    { value: reactions.meh, color: COLORS.warning },
    { value: reactions.bad, color: COLORS.error },
  ];

  return (
    <StatCard title="Episode Reactions" icon="heart-outline">
      <Text style={styles.total}>{reactions.total} episodes rated</Text>
      <SegmentedBar segments={segments} height={12} />
      <View style={styles.labelsRow}>
        <View style={styles.labelItem}>
          <Text style={styles.emoji}>{REACTION_EMOJI.good}</Text>
          <Text style={styles.pct}>{pctGood}%</Text>
          <Text style={styles.count}>{reactions.good}</Text>
        </View>
        <View style={styles.labelItem}>
          <Text style={styles.emoji}>{REACTION_EMOJI.meh}</Text>
          <Text style={styles.pct}>{pctMeh}%</Text>
          <Text style={styles.count}>{reactions.meh}</Text>
        </View>
        <View style={styles.labelItem}>
          <Text style={styles.emoji}>{REACTION_EMOJI.bad}</Text>
          <Text style={styles.pct}>{pctBad}%</Text>
          <Text style={styles.count}>{reactions.bad}</Text>
        </View>
      </View>

      {reactions.topEpisodes.length > 0 && (
        <View style={styles.episodesSection}>
          <Text style={styles.episodesTitle}>Recent Reactions</Text>
          {reactions.topEpisodes.map((ep, i) => (
            <View key={i} style={styles.episodeRow}>
              <Text style={styles.episodeEmoji}>
                {REACTION_EMOJI[ep.reaction] ?? ''}
              </Text>
              <View style={styles.episodeInfo}>
                <Text style={styles.episodeName} numberOfLines={1}>
                  {ep.episodeTitle ?? formatEpCode(ep.seasonNumber, ep.episodeNumber)}
                </Text>
                <Text style={styles.episodeShow} numberOfLines={1}>
                  {ep.showTitle} {'\u00B7'} {formatEpCode(ep.seasonNumber, ep.episodeNumber)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  total: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  labelItem: {
    alignItems: 'center',
    gap: 2,
  },
  emoji: {
    fontSize: 20,
  },
  pct: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  count: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  episodesSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  episodesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  episodeEmoji: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  episodeShow: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 1,
  },
});
