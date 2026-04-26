import * as FileSystem from 'expo-file-system/legacy';
import { EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const exportToCSV = async (data: any[], filename: string) => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return false;
  }
  
  try {
    const keys = Object.keys(data[0]);
    const header = keys.join(',');
    
    const rows = data.map(item => {
      return keys.map(key => {
        let val = item[key];
        if (typeof val === 'string') {
          // Escape quotes and commas
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',');
    });
    
    const csvContent = [header, ...rows].join('\n');
    
    const path = `${FileSystem.documentDirectory}${filename}.csv`;
    await FileSystem.writeAsStringAsync(path, csvContent, { encoding: EncodingType.UTF8 });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV data',
        UTI: 'public.comma-separated-values-text'
      });
      return true;
    } else {
      alert("Sharing is not available on this device.");
      return false;
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export data.');
    return false;
  }
};
