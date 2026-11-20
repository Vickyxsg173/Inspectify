import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConfidenceThresholds {
  /** Confidence threshold for best.pt (Standard Model) — 0.0 to 1.0 */
  best: number;
  /** Confidence threshold for latest_model_defect.pt — 0.0 to 1.0 */
  latest: number;
}

/**
 * Empirically calibrated optimal defaults (restored to green UI baseline):
 *
 * 1. best.pt (Standard Model):
 *    - Has 2 classes: damaged (0) and intact (1).
 *    - Subtle corner damage, creasing, and fine paper separation score ~0.13 - 0.18.
 *    - Optimum calibrated threshold: 0.12 (12%).
 *
 * 2. latest_model_defect.pt (Latest Defect Model):
 *    - Multi-class model (crushed box corner, dented packaging, screen scratch, etc.).
 *    - Corner crush on fine packaging scores ~0.36.
 *    - Optimum calibrated threshold: 0.25 (25%).
 */
export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  best: 0.12,
  latest: 0.25,
};

const CONFIDENCE_KEY = '@inspectify_confidence_thresholds';

export async function getConfidenceThresholds(): Promise<ConfidenceThresholds> {
  try {
    const raw = await AsyncStorage.getItem(CONFIDENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConfidenceThresholds>;
      return {
        best: typeof parsed.best === 'number' ? parsed.best : DEFAULT_THRESHOLDS.best,
        latest: typeof parsed.latest === 'number' ? parsed.latest : DEFAULT_THRESHOLDS.latest,
      };
    }
  } catch (err) {
    console.warn('confidenceStorage getConfidenceThresholds error:', err);
  }
  return { ...DEFAULT_THRESHOLDS };
}

export async function saveConfidenceThresholds(thresholds: ConfidenceThresholds): Promise<void> {
  try {
    await AsyncStorage.setItem(CONFIDENCE_KEY, JSON.stringify(thresholds));
  } catch (err) {
    console.error('confidenceStorage saveConfidenceThresholds error:', err);
  }
}

export async function getThresholdForCurrentModel(modelId: 'best' | 'latest'): Promise<number> {
  const thresholds = await getConfidenceThresholds();
  return thresholds[modelId];
}

