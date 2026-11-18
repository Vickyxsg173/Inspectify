import { BACKEND_URL } from '@/constants/api';
import { getSelectedModel } from '@/utils/modelStorage';
import { getConfidenceThresholds } from '@/utils/confidenceStorage';

export type LiveDefect = {
  id: string;
  label: string;
  category: string;
  confidence: number;
  box_normalized: [number, number, number, number]; // [x1, y1, x2, y2] from 0.0 to 1.0
  box_pixels: [number, number, number, number];
};

export type LiveFrameResult = {
  status: 'DEFECTIVE' | 'INTACT' | 'ERROR';
  defect_count: number;
  max_confidence: number;
  defects: LiveDefect[];
  latency_ms: number;
  snapshot_image?: string;
  error?: string;
};

/**
 * Sends a live camera frame to the backend for defect detection.
 * Model selection and confidence threshold are always driven by
 * the global Settings — no per-call override.
 */
export async function sendLiveFrame(
  base64Image: string,
  saveSnapshot: boolean = false
): Promise<LiveFrameResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const activeModel = await getSelectedModel().catch(() => 'best');
    const thresholds = await getConfidenceThresholds();
    const confidenceThreshold = activeModel === 'latest' ? thresholds.latest : thresholds.best;

    const res = await fetch(`${BACKEND_URL}/api/live-stream/frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        image_base64: base64Image,
        target_model: 'all',          // always inspect all defect types
        save_snapshot: saveSnapshot,
        model_preference: activeModel, // from Settings
        confidence_threshold: confidenceThreshold, // from Settings
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Live frame analysis failed (${res.status})`);
    }

    return (await res.json()) as LiveFrameResult;
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      status: 'ERROR',
      defect_count: 0,
      max_confidence: 0,
      defects: [],
      latency_ms: 0,
      error: err.name === 'AbortError' ? 'Timeout' : err.message || 'Stream error',
    };
  }
}
