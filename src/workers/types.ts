/**
 * Shared types for worker communication
 */

// ============= detectPadding Worker Types =============

export interface DetectPaddingRequest {
  type: 'detect-padding';
  imageData: {
    imageBitmap: ImageBitmap;
    originalWidth: number;
    originalHeight: number;
  };
}

export interface DetectPaddingResponse {
  type: 'detect-padding-result';
  paddingSize: number;
}

export interface DetectPaddingError {
  type: 'detect-padding-error';
  error: string;
}

// ============= cropImage Worker Types =============

export interface CropImageRequest {
  type: 'crop-image';
  imageData: {
    imageBitmap: ImageBitmap;
    originalWidth: number;
    originalHeight: number;
  };
  gridConfig: {
    cols: number;
    rows: number;
    padding: number;
  };
}

export interface CropImageResponse {
  type: 'crop-image-result';
  croppedDataURLs: string[];
}

export interface CropImageError {
  type: 'crop-image-error';
  error: string;
}

// ============= Union Types =============

export type WorkerMessage =
  | DetectPaddingRequest
  | DetectPaddingResponse
  | DetectPaddingError
  | CropImageRequest
  | CropImageResponse
  | CropImageError;

export type DetectPaddingWorkerMessage =
  | DetectPaddingRequest
  | DetectPaddingResponse
  | DetectPaddingError;

export type CropImageWorkerMessage =
  | CropImageRequest
  | CropImageResponse
  | CropImageError;
