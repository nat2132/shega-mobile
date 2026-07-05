import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CSV_SPECS, exportToCSV as exportToCSVFromUtils } from './csv-utils';

export const exportToCSV = async (data: any[], filename: string, moduleKey?: string) => {
  if (!data || !data.length) {
    throw new Error('No data available to export');
  }

  try {
    if (moduleKey && CSV_SPECS[moduleKey]) {
      return await exportToCSVFromUtils(data, moduleKey);
    }

    const keys = Object.keys(data[0]);
    const rows = data.map(item => {
      return keys.map(key => {
        let val = item[key];
        if (typeof val === 'string') {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',');
    });

    const csvContent = [keys.join(','), ...rows].join('\n');
    const path = `${FileSystem.documentDirectory}${filename}.csv`;

    await FileSystem.writeAsStringAsync(path, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV data',
        UTI: 'public.comma-separated-values-text'
      });
      return true;
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
};
