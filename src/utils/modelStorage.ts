import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '@/constants/api';

export type DetectionModelId = 'best' | 'latest';

export interface DetectionModelOption {
  id: DetectionModelId;
  name: string;
  fileName: string;
  badge: string;
  description: string;
}

export const AVAILABLE_MODELS: DetectionModelOption[] = [
  {
    id: 'best',
    name: 'Standard Model',
    fileName: 'best.pt',
    badge: 'Verified & Stable',
    description: 'Primary packaging defect detection model (Default)',
  },
  {
    id: 'latest',
    name: 'Latest Defect Model',
    fileName: 'latest_model_defect.pt',
    badge: 'New (Multi-Defect)',
    description: 'Latest multi-defect detection & segmentation model',
  },
];

const MODEL_STORAGE_KEY = '@inspectify_selected_model';

/**
 * Retrieves the currently selected detection model.
 * Defaults to 'best' (best.pt) for reliability.
 */
export async function getSelectedModel(): Promise<DetectionModelId> {
  try {
    const saved = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
    if (saved === 'latest' || saved === 'best') {
      return saved;
    }
    return 'best';
  } catch (error) {
    console.warn('Error reading selected model from AsyncStorage:', error);
    return 'best';
  }
}

/**
 * Saves the selected detection model to persistent storage
 * and optionally syncs the setting to the backend if reachable.
 */
export async function saveSelectedModel(modelId: DetectionModelId): Promise<void> {
  try {
    await AsyncStorage.setItem(MODEL_STORAGE_KEY, modelId);
    // Best-effort sync to backend
    fetch(`${BACKEND_URL}/api/settings/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId }),
    }).catch(() => {
      // Backend may be offline; local setting remains active
    });
  } catch (error) {
    console.error('Error saving selected model to AsyncStorage:', error);
  }
}

