import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConfidenceThresholds {
  /** Confidence threshold for best.pt (Standard Model) — 0.0 to 1.0 */
  best: number;
  /** Confidence threshold for latest_model_defect.pt — 0.0 to 1.0 */
  latest: number;
  /**
   * Confidence threshold for screen_scratch_model.pt.
   * Hard-capped at 0.08 on the backend; this controls the UI display filter.
   */
  screen: number;
  /**
   * Minimum confidence to show a bounding box overlay in the video inspection player.
   * Boxes below this are hidden in the timeline/frame overlay, even if the backend detected them.
   */
  videoBox: number;
}

/**
 * Empirically calibrated optimal defaults:
 *
 * 1. best.pt (Standard Model):
 *    - Subtle corner damage, creasing score ~0.13-0.18. Optimum: 0.12 (12%).
 *
 * 2. latest_model_defect.pt (Latest Defect Model):
 *    - Corner crush on fine packaging scores ~0.36. Optimum: 0.25 (25%).
 *
 * 3. screen_scratch_model.pt (Screen Scratch / Crack):
 *    - Fine hairline scratches score 0.06-0.10. Optimum: 0.08 (8%).
 *
 * 4. Video bounding box display filter:
 *    - Only show boxes in the video overlay if confidence >= videoBox threshold.
 *    - Default: 0.20 (20%) — filters accidental low-conf noise in video frames.
 */
export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  best: 0.12,
  latest: 0.25,
  screen: 0.08,
  videoBox: 0.20,
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
        screen: typeof parsed.screen === 'number' ? parsed.screen : DEFAULT_THRESHOLDS.screen,
        videoBox: typeof parsed.videoBox === 'number' ? parsed.videoBox : DEFAULT_THRESHOLDS.videoBox,
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

