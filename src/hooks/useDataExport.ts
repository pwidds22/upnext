import { useState, useCallback } from 'react';
import * as Sharing from 'expo-sharing';
import { exportService } from '../services/export';
import { useAuth } from '../contexts/AuthContext';

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const exportData = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Collect all user data
      const data = await exportService.collectExportData(user?.id);

      // Write to file
      const filePath = await exportService.exportToFile(data);

      // Share the file via native share sheet
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export UpNext Data',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export failed';
      setError(message);
      throw e; // Re-throw for caller to handle
    } finally {
      setIsExporting(false);
    }
  }, [user?.id]);

  return { isExporting, error, exportData };
}
