import AsyncStorage from '@react-native-async-storage/async-storage';

const SCAN_HISTORY_KEY = '@inspectify_scan_history';
const AUTO_SAVE_KEY = '@inspectify_auto_save';

export interface ScanRecord {
  id: string;
  type: 'packaging' | 'screen' | 'support';
  title: string;
  status: 'DEFECTIVE' | 'INTACT' | 'Defective' | 'Intact';
  confidence: number;
  imageUri: string;
  annotatedImage?: string;
  reason?: string;
  brand?: string;
  product?: string;
  timestamp: number;
}

export async function isAutoSaveEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUTO_SAVE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export async function setAutoSaveSetting(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_SAVE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving autoSave setting:', error);
  }
}

export async function getScanHistory(): Promise<ScanRecord[]> {
  try {
    const json = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    if (!json) return [];
    const list: ScanRecord[] = JSON.parse(json);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn('Error reading scan history:', error);
    return [];
  }
}

export async function getRecentScans(limit = 3): Promise<ScanRecord[]> {
  const history = await getScanHistory();
  return history.slice(0, limit);
}

export async function saveScan(
  scanData: Omit<ScanRecord, 'id' | 'timestamp'>,
  force = false
): Promise<ScanRecord | null> {
  try {
    const autoSave = await isAutoSaveEnabled();
    if (!autoSave && !force) {
      console.log('Auto-save is disabled. Scan skipped.');
      return null;
    }

    const newRecord: ScanRecord = {
      ...scanData,
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    const currentHistory = await getScanHistory();
    // Keep up to 100 recent scans in storage
    const updatedHistory = [newRecord, ...currentHistory].slice(0, 100);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updatedHistory));

    return newRecord;
  } catch (error) {
    console.error('Error saving scan to history:', error);
    return null;
  }
}

export async function deleteScan(id: string): Promise<void> {
  try {
    const current = await getScanHistory();
    const filtered = current.filter((s) => s.id !== id);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting scan:', error);
  }
}

export async function clearScanHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SCAN_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing scan history:', error);
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
