import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File } from 'expo-file-system';
import JSZip from 'jszip';

import { COLORS } from '../utils/constants';
import {
  ImportSourceType,
  ImportProgress,
  ImportResult,
  NormalizedImportData,
} from '../types';
import { executeImport } from '../services/import';
import { parseUpNextJson } from '../services/importSources/upnextJson';
import { parseTVTimeExport } from '../services/importSources/tvtime';
import { parseLetterboxdExport } from '../services/importSources/letterboxd';

// Source configuration
const IMPORT_SOURCES: Array<{
  type: ImportSourceType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  fileType: 'json' | 'zip' | 'oauth';
}> = [
  {
    type: 'trakt',
    label: 'Trakt',
    description: 'Import via Trakt API (requires account)',
    icon: 'globe-outline',
    fileType: 'oauth',
  },
  {
    type: 'tvtime',
    label: 'TV Time',
    description: 'Import from GDPR export (ZIP file)',
    icon: 'time-outline',
    fileType: 'zip',
  },
  {
    type: 'simkl',
    label: 'SIMKL',
    description: 'Import via SIMKL API (requires account)',
    icon: 'film-outline',
    fileType: 'oauth',
  },
  {
    type: 'letterboxd',
    label: 'Letterboxd',
    description: 'Import movies from CSV export (ZIP)',
    icon: 'videocam-outline',
    fileType: 'zip',
  },
  {
    type: 'upnext',
    label: 'UpNext Backup',
    description: 'Restore from a previous export',
    icon: 'download-outline',
    fileType: 'json',
  },
];

type ScreenState = 'source_select' | 'importing' | 'results';

export default function ImportScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('source_select');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProgress = useCallback((p: ImportProgress) => {
    setProgress(p);
  }, []);

  const handleFileImport = useCallback(
    async (sourceType: ImportSourceType, fileType: 'json' | 'zip') => {
      try {
        // Pick file
        const pickerResult = await DocumentPicker.getDocumentAsync({
          type: fileType === 'json' ? 'application/json' : 'application/zip',
          copyToCacheDirectory: true,
        });

        if (pickerResult.canceled) return;

        const fileUri = pickerResult.assets[0].uri;
        setScreenState('importing');
        setError(null);
        setProgress({
          phase: 'parsing',
          current: 0,
          total: 0,
          message: 'Reading file...',
        });

        let normalizedData: NormalizedImportData;

        if (fileType === 'json') {
          // Read JSON file directly
          const file = new File(fileUri);
          const content = await file.text();
          normalizedData = parseUpNextJson(content);
        } else {
          // Read and extract ZIP file
          const file = new File(fileUri);
          const content = await file.text();

          // JSZip needs ArrayBuffer, but we'll use base64 approach
          // Read as binary string for JSZip
          const response = await fetch(fileUri);
          const blob = await response.blob();
          const arrayBuffer = await new Response(blob).arrayBuffer();

          const zip = await JSZip.loadAsync(arrayBuffer);
          const files: Record<string, string> = {};

          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            // Extract just the filename (ignore directory structure)
            const baseName = filename.split('/').pop() || filename;
            try {
              files[baseName] = await zipEntry.async('text');
            } catch {
              // Skip files that can't be read as text
            }
          }

          if (sourceType === 'tvtime') {
            normalizedData = parseTVTimeExport(files);
          } else if (sourceType === 'letterboxd') {
            normalizedData = parseLetterboxdExport(files);
          } else {
            throw new Error(`Unsupported file import source: ${sourceType}`);
          }
        }

        // Execute the import
        setProgress({
          phase: 'resolving_ids',
          current: 0,
          total: 0,
          message: 'Starting import...',
        });

        const importResult = await executeImport(normalizedData, handleProgress);
        setResult(importResult);
        setScreenState('results');
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Import failed';
        setError(message);
        setScreenState('source_select');
        Alert.alert('Import Error', message);
      }
    },
    [handleProgress],
  );

  const handleOAuthImport = useCallback(
    (sourceType: ImportSourceType) => {
      // OAuth-based imports (Trakt, SIMKL) require API keys and OAuth flow
      // For now, show a placeholder message
      Alert.alert(
        `${sourceType === 'trakt' ? 'Trakt' : 'SIMKL'} Import`,
        `To import from ${sourceType === 'trakt' ? 'Trakt' : 'SIMKL'}, you'll need to connect your account. This feature requires API configuration.\n\nComing soon in a future update!`,
        [{ text: 'OK' }],
      );
    },
    [],
  );

  const handleSourcePress = useCallback(
    (source: (typeof IMPORT_SOURCES)[number]) => {
      if (source.fileType === 'oauth') {
        handleOAuthImport(source.type);
      } else {
        handleFileImport(source.type, source.fileType);
      }
    },
    [handleFileImport, handleOAuthImport],
  );

  const handleReset = useCallback(() => {
    setScreenState('source_select');
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      {screenState === 'source_select' && (
        <SourceSelectView onSourcePress={handleSourcePress} />
      )}
      {screenState === 'importing' && progress && (
        <ImportingView progress={progress} />
      )}
      {screenState === 'results' && result && (
        <ResultsView result={result} onDone={handleReset} />
      )}
    </View>
  );
}

// ==================== Source Selection View ====================

function SourceSelectView({
  onSourcePress,
}: {
  onSourcePress: (source: (typeof IMPORT_SOURCES)[number]) => void;
}) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>Import Data</Text>
      <Text style={styles.headerSubtitle}>
        Bring your watch history from another app or restore from a backup.
      </Text>

      <View style={styles.sourceList}>
        {IMPORT_SOURCES.map((source) => (
          <TouchableOpacity
            key={source.type}
            style={styles.sourceCard}
            onPress={() => onSourcePress(source)}
            activeOpacity={0.7}
          >
            <View style={styles.sourceIconContainer}>
              <Ionicons name={source.icon} size={28} color={COLORS.primary} />
            </View>
            <View style={styles.sourceTextContainer}>
              <Text style={styles.sourceLabel}>{source.label}</Text>
              <Text style={styles.sourceDescription}>{source.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoSection}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
        <Text style={styles.infoText}>
          Your existing data won't be overwritten. Duplicate shows and episodes are automatically
          skipped.
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>How to get your data</Text>

        <View style={styles.helpItem}>
          <Text style={styles.helpSource}>TV Time</Text>
          <Text style={styles.helpText}>
            Email support@tvtime.com with your User ID, email, and last 3 things watched. You'll
            receive a ZIP file within 7 days.
          </Text>
        </View>

        <View style={styles.helpItem}>
          <Text style={styles.helpSource}>Letterboxd</Text>
          <Text style={styles.helpText}>
            Go to Settings → Import & Export → Export Your Data. You'll get a ZIP file instantly.
          </Text>
        </View>

        <View style={styles.helpItem}>
          <Text style={styles.helpSource}>Trakt / SIMKL</Text>
          <Text style={styles.helpText}>
            These use API import — connect your account and we'll fetch your data directly.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ==================== Importing Progress View ====================

function ImportingView({ progress }: { progress: ImportProgress }) {
  const phaseLabels: Record<string, string> = {
    parsing: 'Reading data',
    resolving_ids: 'Finding shows on TMDB',
    importing: 'Saving to library',
    complete: 'Done!',
    error: 'Error',
  };

  const percentage =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.progressPhase}>{phaseLabels[progress.phase] || progress.phase}</Text>
      <Text style={styles.progressMessage}>{progress.message}</Text>
      {progress.total > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      )}
      {progress.total > 0 && (
        <Text style={styles.progressCount}>
          {progress.current} / {progress.total} ({percentage}%)
        </Text>
      )}
    </View>
  );
}

// ==================== Results View ====================

function ResultsView({
  result,
  onDone,
}: {
  result: ImportResult;
  onDone: () => void;
}) {
  const totalImported = result.showsImported + result.moviesImported + result.episodesImported;
  const totalSkipped = result.showsSkipped + result.moviesSkipped + result.episodesSkipped;
  const durationSec = (result.durationMs / 1000).toFixed(1);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.resultHeader}>
        <Ionicons
          name={totalImported > 0 ? 'checkmark-circle' : 'alert-circle'}
          size={64}
          color={totalImported > 0 ? COLORS.primary : COLORS.warning}
        />
        <Text style={styles.resultTitle}>
          {totalImported > 0 ? 'Import Complete!' : 'Nothing New to Import'}
        </Text>
        <Text style={styles.resultSubtitle}>Completed in {durationSec}s</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatItem label="Shows" value={result.showsImported} skipped={result.showsSkipped} />
        <StatItem label="Movies" value={result.moviesImported} skipped={result.moviesSkipped} />
        <StatItem label="Episodes" value={result.episodesImported} skipped={result.episodesSkipped} />
        {result.ratingsImported > 0 && (
          <StatItem label="Ratings" value={result.ratingsImported} skipped={0} />
        )}
      </View>

      {result.unresolved.length > 0 && (
        <View style={styles.unresolvedSection}>
          <Text style={styles.sectionTitle}>
            Couldn't find ({result.unresolved.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            These items couldn't be matched to TMDB. You can search for them manually.
          </Text>
          {result.unresolved.slice(0, 20).map((item, index) => (
            <View key={index} style={styles.unresolvedItem}>
              <Ionicons name="help-circle-outline" size={18} color={COLORS.warning} />
              <Text style={styles.unresolvedText} numberOfLines={1}>
                {item.candidate.title}
                {item.candidate.year ? ` (${item.candidate.year})` : ''}
              </Text>
            </View>
          ))}
          {result.unresolved.length > 20 && (
            <Text style={styles.moreText}>
              +{result.unresolved.length - 20} more items
            </Text>
          )}
        </View>
      )}

      {result.errors.length > 0 && (
        <View style={styles.errorsSection}>
          <Text style={styles.sectionTitle}>Errors ({result.errors.length})</Text>
          {result.errors.slice(0, 10).map((err, index) => (
            <Text key={index} style={styles.errorText} numberOfLines={2}>
              {err}
            </Text>
          ))}
          {result.errors.length > 10 && (
            <Text style={styles.moreText}>
              +{result.errors.length - 10} more errors
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatItem({ label, value, skipped }: { label: string; value: number; skipped: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {skipped > 0 && (
        <Text style={styles.statSkipped}>{skipped} already existed</Text>
      )}
    </View>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  sourceList: {
    gap: 12,
    marginBottom: 24,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  sourceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sourceTextContainer: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  sourceDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  helpSection: {
    gap: 16,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  helpItem: {
    gap: 4,
  },
  helpSource: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  helpText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  progressPhase: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  resultSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statSkipped: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  unresolvedSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  unresolvedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  unresolvedText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  moreText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorsSection: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    paddingVertical: 4,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
});
