/**
 * Worker for cropping image into grid frames
 * Uses OffscreenCanvas API (modern browsers only)
 */

import type { CropImageWorkerMessage, CropImageResponse, CropImageError } from './types';

/**
 * Helper: Convert Blob to Data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Main cropping logic using OffscreenCanvas
 */
async function cropImage(
  imageBitmap: ImageBitmap,
  cols: number,
  rows: number,
  padding: number
): Promise<string[]> {
  const W = imageBitmap.width;
  const H = imageBitmap.height;
  const totalCrops = cols * rows;
  const crops: string[] = [];

  // Calculate cell dimensions
  const cellWidth = (W - padding * (cols - 1)) / cols;
  const cellHeight = (H - padding * (rows - 1)) / rows;

  for (let i = 0; i < totalCrops; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Calculate position accounting for padding
    const x = col * (cellWidth + padding);
    const y = row * (cellHeight + padding);

    // Create OffscreenCanvas for each crop
    const offscreen = new OffscreenCanvas(cellWidth, cellHeight);
    const ctx = offscreen.getContext('2d');

    if (!ctx) {
      throw new Error(`Failed to get OffscreenCanvas context for crop ${i}`);
    }

    // Draw the cropped region
    ctx.drawImage(
      imageBitmap,
      x, y, cellWidth, cellHeight,  // Source
      0, 0, cellWidth, cellHeight   // Destination
    );

    // Convert to blob, then to data URL
    const blob = await offscreen.convertToBlob({ type: 'image/png' });

    // Convert blob to base64 data URL
    const dataURL = await blobToDataURL(blob);
    crops.push(dataURL);
  }

  return crops;
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent<CropImageWorkerMessage>) => {
  const message = event.data;

  if (message.type === 'crop-image') {
    try {
      const { imageBitmap } = message.imageData;
      const { cols, rows, padding } = message.gridConfig;

      const croppedDataURLs = await cropImage(imageBitmap, cols, rows, padding);

      // Close the bitmap to free memory
      imageBitmap.close();

      const response: CropImageResponse = {
        type: 'crop-image-result',
        croppedDataURLs,
      };

      self.postMessage(response);
    } catch (error) {
      const errorResponse: CropImageError = {
        type: 'crop-image-error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      self.postMessage(errorResponse);
    }
  }
};

export type {};
