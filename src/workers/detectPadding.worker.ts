/**
 * Worker for detecting white space padding between grid frames
 * Uses OffscreenCanvas API (modern browsers only)
 */

import type { DetectPaddingWorkerMessage, DetectPaddingResponse, DetectPaddingError } from './types';

// White threshold (allowing slight variations)
const WHITE_THRESHOLD = 250;

/**
 * Helper to check if a pixel is white
 */
function isWhite(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return true;
  const i = (y * width + x) * 4;
  return (
    data[i] >= WHITE_THRESHOLD &&
    data[i + 1] >= WHITE_THRESHOLD &&
    data[i + 2] >= WHITE_THRESHOLD
  );
}

/**
 * Detect vertical white lines (gutters between columns)
 */
function detectVerticalGaps(data: Uint8ClampedArray, width: number, height: number): Set<number> {
  const gaps = new Set<number>();

  // Scan multiple horizontal lines
  for (const scanY of [
    Math.floor(height * 0.1),
    Math.floor(height * 0.5),
    Math.floor(height * 0.9),
  ]) {
    let inGap = false;
    let gapStart = -1;

    for (let x = 1; x < width - 1; x++) {
      const white = isWhite(data, width, height, x, scanY);

      if (white && !inGap) {
        inGap = true;
        gapStart = x;
      } else if (!white && inGap) {
        inGap = false;
        const gapSize = x - gapStart;
        if (gapSize >= 1 && gapSize < width * 0.2) {
          gaps.add(gapSize);
        }
      }
    }
  }
  return gaps;
}

/**
 * Detect horizontal white lines (gutters between rows)
 */
function detectHorizontalGaps(data: Uint8ClampedArray, width: number, height: number): Set<number> {
  const gaps = new Set<number>();

  // Scan multiple vertical lines
  for (const scanX of [
    Math.floor(width * 0.1),
    Math.floor(width * 0.5),
    Math.floor(width * 0.9),
  ]) {
    let inGap = false;
    let gapStart = -1;

    for (let y = 1; y < height - 1; y++) {
      const white = isWhite(data, width, height, scanX, y);

      if (white && !inGap) {
        inGap = true;
        gapStart = y;
      } else if (!white && inGap) {
        inGap = false;
        const gapSize = y - gapStart;
        if (gapSize >= 1 && gapSize < height * 0.2) {
          gaps.add(gapSize);
        }
      }
    }
  }
  return gaps;
}

/**
 * Main padding detection logic using OffscreenCanvas
 */
async function detectPadding(imageBitmap: ImageBitmap): Promise<number> {
  const maxScanSize = 900;
  const scale = Math.min(1, maxScanSize / Math.max(imageBitmap.width, imageBitmap.height));

  // Use OffscreenCanvas in worker context
  const offscreen = new OffscreenCanvas(
    imageBitmap.width * scale,
    imageBitmap.height * scale
  );
  const ctx = offscreen.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get OffscreenCanvas context');
  }

  // Disable image smoothing to preserve original pixels better
  ctx.imageSmoothingEnabled = false;

  // Draw scaled image
  ctx.drawImage(imageBitmap, 0, 0, offscreen.width, offscreen.height);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const { data, width, height } = imageData;

  // Debug: log gap detection details
  console.log('[detectPadding.worker] scale:', scale, 'width:', width, 'height:', height);

  // Detect gaps
  const vGaps = detectVerticalGaps(data, width, height);
  const hGaps = detectHorizontalGaps(data, width, height);

  console.log('[detectPadding.worker] vGaps:', [...vGaps], 'hGaps:', [...hGaps]);

  // Find most common gap size
  const allGaps = [...vGaps, ...hGaps];
  if (allGaps.length === 0) return 0;

  // Count frequency (rounding to nearest 2px for scaling artifacts)
  const frequency = new Map<number, number>();
  for (const gap of allGaps) {
    const rounded = Math.round(gap / 2) * 2;
    frequency.set(rounded, (frequency.get(rounded) || 0) + 1);
  }

  console.log('[detectPadding.worker] frequency:', Object.fromEntries(frequency));

  // Find most frequent
  let maxFreq = 0;
  let mostCommonGap = 0;
  for (const [size, freq] of frequency) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mostCommonGap = size;
    }
  }

  // Scale back to original dimensions
  const result = Math.round(mostCommonGap / scale);
  console.log('[detectPadding.worker] mostCommonGap:', mostCommonGap, 'result:', result);
  return result;
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent<DetectPaddingWorkerMessage>) => {
  const message = event.data;

  if (message.type === 'detect-padding') {
    try {
      const { imageBitmap } = message.imageData;
      const paddingSize = await detectPadding(imageBitmap);

      // Close the bitmap to free memory
      imageBitmap.close();

      const response: DetectPaddingResponse = {
        type: 'detect-padding-result',
        paddingSize,
      };

      self.postMessage(response);
    } catch (error) {
      const errorResponse: DetectPaddingError = {
        type: 'detect-padding-error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      self.postMessage(errorResponse);
    }
  }
};

export type {};
