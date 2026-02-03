import { useState, useCallback } from 'react';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { exportService } from '../services/export';
import { useAuth } from '../contexts/AuthContext';

/**
 * Check if an error is from the user cancelling the share sheet
 * (not a real failure - user intentionally dismissed)
 */
function isShareCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('user did not share') ||
    message.includes('cancelled') ||
    message.includes('canceled')
  );
}

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();

  const exportData = useCallback(async (): Promise<'shared' | 'cancelled'> => {
    setIsExporting(true);
    let filePath: string | null = null;

    try {
      // Check if sharing is available on this device
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Collect all user data
      const data = await exportService.collectExportData(user?.id);

      // Write to file
      filePath = await exportService.exportToFile(data);

      // Share the file via native share sheet
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export UpNext Data',
      });

      return 'shared';
    } catch (e) {
      // User cancelling share sheet is not an error
      if (isShareCancellation(e)) {
        return 'cancelled';
      }
      throw e; // Re-throw actual errors for caller to handle
    } finally {
      setIsExporting(false);
      // Clean up temp file (use legacy API which accepts URI strings)
      if (filePath) {
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }, [user?.id]);

  return { isExporting, exportData };
}
