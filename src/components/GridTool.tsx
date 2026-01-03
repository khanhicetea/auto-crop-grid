import JSZip from "jszip";
import { Download, RefreshCw, Scissors, Upload } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface GridToolProps {
  onUseImage?: (dataURL: string, fileName: string) => void;
}

interface PaddingInfo {
  size: number;
  detected: boolean;
}

interface Preset {
  cols: number;
  rows: number;
  label: string;
}

export function GridTool({ onUseImage }: GridToolProps) {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [croppedImages, setCroppedImages] = useState<string[]>([]);
  const [croppedDataURLs, setCroppedDataURLs] = useState<string[]>([]);
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [columns, setColumns] = useState<number>(3);
  const [rows, setRows] = useState<number>(3);
  const [autoPadding, setAutoPadding] = useState<boolean>(false);
  const [paddingInfo, setPaddingInfo] = useState<PaddingInfo>({
    size: 0,
    detected: false,
  });

  const presets: Preset[] = [
    { cols: 1, rows: 1, label: "1×1" },
    { cols: 2, rows: 2, label: "2×2" },
    { cols: 3, rows: 3, label: "3×3" },
    { cols: 4, rows: 4, label: "4×4" },
    { cols: 2, rows: 3, label: "2×3" },
    { cols: 3, rows: 4, label: "3×4" },
  ];

  /**
   * Detects the white space padding size between frames in a grid image.
   * Scans for vertical and horizontal white lines (gutters) within the image.
   * Works for grids with padding BETWEEN frames, not just on outer edges.
   */
  const detectPadding = (img: HTMLImageElement): number => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;

    const maxScanSize = 900;
    const scale = Math.min(1, maxScanSize / Math.max(img.width, img.height));
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // White threshold (allowing slight variations)
    const whiteThreshold = 250;

    // Helper to check if a pixel is white
    const isWhite = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return true;
      const i = (y * width + x) * 4;
      return (
        data[i] >= whiteThreshold &&
        data[i + 1] >= whiteThreshold &&
        data[i + 2] >= whiteThreshold
      );
    };

    // Detect vertical white lines (gutters between columns)
    const detectVerticalGaps = (): Set<number> => {
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
          const white = isWhite(x, scanY);

          if (white && !inGap) {
            // Start of potential gap
            inGap = true;
            gapStart = x;
          } else if (!white && inGap) {
            // End of gap
            inGap = false;
            const gapSize = x - gapStart;
            // Only count gaps that are at least 1px and less than 20% of image width
            if (gapSize >= 1 && gapSize < width * 0.2) {
              gaps.add(gapSize);
            }
          }
        }
      }
      return gaps;
    };

    // Detect horizontal white lines (gutters between rows)
    const detectHorizontalGaps = (): Set<number> => {
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
          const white = isWhite(scanX, y);

          if (white && !inGap) {
            // Start of potential gap
            inGap = true;
            gapStart = y;
          } else if (!white && inGap) {
            // End of gap
            inGap = false;
            const gapSize = y - gapStart;
            // Only count gaps that are at least 1px and less than 20% of image height
            if (gapSize >= 1 && gapSize < height * 0.2) {
              gaps.add(gapSize);
            }
          }
        }
      }
      return gaps;
    };

    const vGaps = detectVerticalGaps();
    const hGaps = detectHorizontalGaps();

    // Find the most common gap size (mode)
    const allGaps = [...vGaps, ...hGaps];
    if (allGaps.length === 0) return 0;

    // Count frequency of each gap size (rounding to nearest 2px to account for scaling artifacts)
    const frequency = new Map<number, number>();
    for (const gap of allGaps) {
      const rounded = Math.round(gap / 2) * 2;
      frequency.set(rounded, (frequency.get(rounded) || 0) + 1);
    }

    // Find the most frequent gap size
    let maxFreq = 0;
    let mostCommonGap = 0;
    for (const [size, freq] of frequency) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostCommonGap = size;
      }
    }

    // Scale back to original image dimensions
    return Math.round(mostCommonGap / scale);
  };

  const cropImage = (
    img: HTMLImageElement,
    cols: number,
    rows: number,
    padding: number = 0,
  ): string[] => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const W = img.width;
    const H = img.height;
    const crops: string[] = [];
    const totalCrops = cols * rows;

    // Calculate cell dimensions without padding
    // The grid has (cols + 1) vertical padding strips and (rows + 1) horizontal
    // But the outer edge may or may not have padding, so we calculate based on total space
    const cellWidth = (W - padding * (cols - 1)) / cols;
    const cellHeight = (H - padding * (rows - 1)) / rows;

    for (let i = 0; i < totalCrops; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      // Calculate position accounting for padding between cells
      const x = col * (cellWidth + padding);
      const y = row * (cellHeight + padding);

      const quad = {
        x,
        y,
        w: cellWidth,
        h: cellHeight,
      };

      canvas.width = quad.w;
      canvas.height = quad.h;
      ctx.drawImage(img, quad.x, quad.y, quad.w, quad.h, 0, 0, quad.w, quad.h);
      crops.push(canvas.toDataURL());
    }

    return crops;
  };

  // Auto-detect padding when image or auto-padding setting changes
  useEffect(() => {
    if (originalImage && autoPadding) {
      const detectedSize = detectPadding(originalImage);
      setPaddingInfo({ size: detectedSize, detected: true });
    } else {
      setPaddingInfo({ size: 0, detected: false });
    }
  }, [originalImage, autoPadding, detectPadding]);

  useEffect(() => {
    if (originalImage) {
      const padding = autoPadding ? paddingInfo.size : 0;
      const crops = cropImage(originalImage, columns, rows, padding);
      setCroppedImages(crops);
      setCroppedDataURLs(crops);
    }
  }, [originalImage, columns, rows, cropImage, autoPadding, paddingInfo.size]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalFileName(file.name);
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          const img = new Image();
          img.onload = () => {
            setOriginalImage(img);
            setIsProcessing(false);
            if (onUseImage) {
              onUseImage(img.src, file.name);
            }
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const dataURLToBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const downloadSingleImage = (dataURL: string, index: number) => {
    const blob = dataURLToBlob(dataURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}-${index + 1}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = () => {
    const zip = new JSZip();
    croppedDataURLs.forEach((dataURL, i) => {
      const blob = dataURLToBlob(dataURL);
      const baseName = originalFileName.replace(/\.[^/.]+$/, "");
      zip.file(`${baseName}-${i + 1}.png`, blob);
    });
    zip.generateAsync({ type: "blob" }).then((content) => {
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${originalFileName.replace(/\.[^/.]+$/, "")}-crops.zip`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Grid Crop Tool</h2>
        <p className="text-xs text-gray-500">Upload & crop image into grid</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={`${preset.cols}x${preset.rows}`}
                onClick={() => {
                  setColumns(preset.cols);
                  setRows(preset.rows);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  columns === preset.cols && rows === preset.rows
                    ? "bg-black text-white shadow-md scale-105"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Columns
            </label>
            <input
              type="number"
              min="1"
              value={columns}
              onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Rows
            </label>
            <input
              type="number"
              min="1"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 1)}
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPadding}
              onChange={(e) => setAutoPadding(e.target.checked)}
              className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
            />
            <span className="text-xs font-semibold text-gray-700 px-2 py-1 ">
              Auto-detect whitespace paddings
            </span>
            {paddingInfo.detected && paddingInfo.size > 0 && (
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                {paddingInfo.size}px
              </div>
            )}
            {paddingInfo.detected && paddingInfo.size === 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                No padding
              </div>
            )}
          </label>
        </div>
      </div>

      {isProcessing && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-gray-600"></div>
          <p className="mt-3 text-sm text-gray-600 font-medium">
            Processing image...
          </p>
        </div>
      )}

      {!isProcessing && originalImage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-700">Original</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {originalImage.width} × {originalImage.height}
                </span>
                <input
                  id="grid-file-change"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="grid-file-change"
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-2 py-1 rounded cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  Change
                </label>
              </div>
            </div>
            <img
              src={originalImage.src}
              alt="Original"
              className="w-full h-auto rounded-lg"
            />
          </div>

          {croppedImages.length > 0 && (
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-700">
                    Cropped Frames ({croppedImages.length})
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {Math.round(originalImage.width / columns)} ×{" "}
                    {Math.round(originalImage.height / rows)}
                  </span>
                </div>
                <button
                  onClick={downloadZip}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download ZIP
                </button>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(columns, 4)}, minmax(0, 1fr))`,
                }}
              >
                {croppedImages.map((src, i) => (
                  <div
                    key={i}
                    className="relative group bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition-all"
                  >
                    <img
                      src={src}
                      alt={`Crop ${i + 1}`}
                      className="w-full h-auto"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-black text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-sm">
                      {i + 1}
                    </div>
                    <button
                      onClick={() => downloadSingleImage(croppedDataURLs[i], i)}
                      className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white text-black p-1 rounded shadow-sm hover:shadow-md transition-all"
                      title="Download image"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        onUseImage?.(
                          croppedDataURLs[i],
                          `${originalFileName.replace(/\.[^/.]+$/, "")}-${i + 1}.png`,
                        )
                      }
                      className="absolute top-1.5 right-10 bg-white/90 hover:bg-white text-black p-1 rounded shadow-sm hover:shadow-md transition-all"
                      title="Use in Single Crop"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isProcessing && !originalImage && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-3">
            <Scissors className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 font-medium mb-3">
            Upload an image to crop into grid
          </p>
          <input
            id="grid-file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="grid-file-upload"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Choose Image
          </label>
          <p className="text-xs text-gray-400 mt-3">
            Supports JPG, PNG, GIF, WebP
          </p>
        </div>
      )}
    </div>
  );
}
