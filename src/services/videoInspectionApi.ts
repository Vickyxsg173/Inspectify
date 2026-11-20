import * as FileSystem from 'expo-file-system/legacy';
import { BACKEND_URL } from '@/constants/api';
import { getSelectedModel } from '@/utils/modelStorage';
import { getConfidenceThresholds } from '@/utils/confidenceStorage';

export type VideoInspectionStatus = {
  inspection_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  stage?: string;
  error?: string;
};

export type VideoInspectionResults = {
  inspection_id: string;
  video_duration_seconds: number;
  total_extracted_frames: number;
  total_processed_frames: number;
  defective_frames: number;
  non_defective_frames: number;
  defect_categories: Array<{ name: string; confidence?: number }>;
  defect_timestamps: Array<{ timestamp_seconds: number; category: string; confidence?: number; annotated_frame_url?: string }>;
  summary?: string;
  annotated_video_url?: string;
};

const VIDEO_ENDPOINT = `${BACKEND_URL}/api/video-inspection`;

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Video inspection request failed (${response.status})`);
  }
  return body as T;
}

export async function uploadVideo(uri: string, filename: string, fps: number, onProgress?: (progress: number) => void): Promise<string> {
  const thresholds = await getConfidenceThresholds();
  // Video inspection strictly uses best.pt (Packaging defect model) as before
  const confidenceThreshold = thresholds.best;

  const task = FileSystem.createUploadTask(`${VIDEO_ENDPOINT}/upload`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: filename.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
    parameters: {
      extraction_fps: String(fps),
      model: 'best',
      confidence_threshold: String(confidenceThreshold),
    },
    headers: { Accept: 'application/json' },
  }, event => {
    if (event.totalBytesExpectedToSend > 0) {
      onProgress?.(Math.min(5, (event.totalBytesSent / event.totalBytesExpectedToSend) * 5));
    }
  });
  const response = await task.uploadAsync();
  if (!response) throw new Error('Video upload was interrupted before the server responded.');
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.body || `Video upload failed (${response.status})`);
  }
  const data = JSON.parse(response.body);
  const id = data.inspection_id || data.job_id;
  if (!id) throw new Error('The video API did not return an inspection ID.');
  return id;
}

export async function getVideoInspectionStatus(id: string): Promise<VideoInspectionStatus> {
  return parseResponse(await fetch(`${VIDEO_ENDPOINT}/status/${encodeURIComponent(id)}`));
}

export async function getVideoInspectionResults(id: string): Promise<VideoInspectionResults> {
  return parseResponse(await fetch(`${VIDEO_ENDPOINT}/results/${encodeURIComponent(id)}`));
}
