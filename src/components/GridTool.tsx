import JSZip from "jszip";
import { Download, RefreshCw, Scissors, Upload } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CropImageError,
  CropImageRequest,
  CropImageResponse,
  DetectPaddingError,
  DetectPaddingRequest,
  DetectPaddingResponse,
} from "../workers/types";

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

  // Worker state
  const detectPaddingWorker = useRef<Worker | null>(null);
  const cropImageWorker = useRef<Worker | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [offscreenCanvasSupported, setOffscreenCanvasSupported] =
    useState(true);

  const presets: Preset[] = [
    { cols: 1, rows: 1, label: "1×1" },
    { cols: 2, rows: 2, label: "2×2" },
    { cols: 3, rows: 3, label: "3×3" },
    { cols: 4, rows: 4, label: "4×4" },
    { cols: 5, rows: 5, label: "5×5" },
    { cols: 2, rows: 3, label: "2×3" },
    { cols: 3, rows: 4, label: "3×4" },
  ];

  /**
   * Detect padding using Web Worker with OffscreenCanvas
   */
  const detectPaddingWithWorker = useCallback(
    (img: HTMLImageElement): Promise<number> => {
      return new Promise((resolve, reject) => {
        if (!detectPaddingWorker.current) {
          reject(new Error("Detect padding worker not initialized"));
          return;
        }

        // Convert HTMLImageElement to ImageBitmap (transferable)
        createImageBitmap(img)
          .then((imageBitmap) => {
            // Set up one-time message handler
            const handler = (event: MessageEvent) => {
              const message = event.data as
                | DetectPaddingResponse
                | DetectPaddingError;

              if (message.type === "detect-padding-result") {
                detectPaddingWorker.current?.removeEventListener(
                  "message",
                  handler,
                );
                resolve(message.paddingSize);
              } else if (message.type === "detect-padding-error") {
                detectPaddingWorker.current?.removeEventListener(
                  "message",
                  handler,
                );
                reject(new Error(message.error));
              }
            };

            detectPaddingWorker.current.addEventListener("message", handler);

            // Send request to worker
            const request: DetectPaddingRequest = {
              type: "detect-padding",
              imageData: {
                imageBitmap,
                originalWidth: img.width,
                originalHeight: img.height,
              },
            };

            // Transfer the ImageBitmap (zero-copy)
            detectPaddingWorker.current.postMessage(request, [imageBitmap]);
          })
          .catch(reject);
      });
    },
    [],
  );

  /**
   * Crop image using Web Worker with OffscreenCanvas
   */
  const cropImageWithWorker = useCallback(
    (
      img: HTMLImageElement,
      cols: number,
      rows: number,
      padding: number,
    ): Promise<string[]> => {
      return new Promise((resolve, reject) => {
        if (!cropImageWorker.current) {
          reject(new Error("Crop image worker not initialized"));
          return;
        }

        // Convert to ImageBitmap
        createImageBitmap(img)
          .then((imageBitmap) => {
            const handler = (event: MessageEvent) => {
              const message = event.data as CropImageResponse | CropImageError;

              if (message.type === "crop-image-result") {
                cropImageWorker.current?.removeEventListener(
                  "message",
                  handler,
                );
                resolve(message.croppedDataURLs);
              } else if (message.type === "crop-image-error") {
                cropImageWorker.current?.removeEventListener(
                  "message",
                  handler,
                );
                reject(new Error(message.error));
              }
            };

            cropImageWorker.current.addEventListener("message", handler);

            const request: CropImageRequest = {
              type: "crop-image",
              imageData: {
                imageBitmap,
                originalWidth: img.width,
                originalHeight: img.height,
              },
              gridConfig: {
                cols,
                rows,
                padding,
              },
            };

            // Transfer the ImageBitmap
            cropImageWorker.current.postMessage(request, [imageBitmap]);
          })
          .catch(reject);
      });
    },
    [],
  );

  // Initialize workers and check browser compatibility
  useEffect(() => {
    // Check if OffscreenCanvas is supported
    if (typeof OffscreenCanvas === "undefined") {
      setOffscreenCanvasSupported(false);
      setWorkerError(
        "OffscreenCanvas is not supported in this browser. Please use a modern browser (Chrome 69+, Firefox 105+, Safari 16.4+).",
      );
      return;
    }

    let detectWorker: Worker | null = null;
    let cropWorker: Worker | null = null;

    try {
      detectWorker = new Worker(
        new URL("../workers/detectPadding.worker.ts", import.meta.url),
        { type: "module" },
      );
      cropWorker = new Worker(
        new URL("../workers/cropImage.worker.ts", import.meta.url),
        { type: "module" },
      );

      // Handle worker errors
      detectWorker.onerror = (error) => {
        console.error("Detect padding worker error:", error);
        setWorkerError("Padding detection worker failed");
      };

      cropWorker.onerror = (error) => {
        console.error("Crop image worker error:", error);
        setWorkerError("Crop image worker failed");
      };

      detectPaddingWorker.current = detectWorker;
      cropImageWorker.current = cropWorker;
    } catch (error) {
      console.error("Worker initialization failed:", error);
      setWorkerError(
        "Failed to initialize workers. OffscreenCanvas may not be supported.",
      );
    }

    return () => {
      detectWorker?.terminate();
      cropWorker?.terminate();
    };
  }, []);

  // Auto-detect padding when image or auto-padding setting changes
  useEffect(() => {
    let mounted = true;

    const detectPaddingAsync = async () => {
      if (originalImage && autoPadding && detectPaddingWorker.current) {
        try {
          setIsProcessing(true);
          const detectedSize = await detectPaddingWithWorker(originalImage);
          if (mounted) {
            setPaddingInfo({ size: detectedSize, detected: true });
          }
        } catch (error) {
          if (mounted) {
            console.error("Padding detection failed:", error);
            setWorkerError(
              error instanceof Error ? error.message : "Unknown error",
            );
            setPaddingInfo({ size: 0, detected: false });
          }
        } finally {
          if (mounted) {
            setIsProcessing(false);
          }
        }
      } else {
        setPaddingInfo({ size: 0, detected: false });
      }
    };

    detectPaddingAsync();

    return () => {
      mounted = false;
    };
  }, [originalImage, autoPadding, detectPaddingWithWorker]);

  useEffect(() => {
    let mounted = true;

    const cropImageAsync = async () => {
      // Wait for padding detection to complete if autoPadding is enabled
      if (autoPadding && !paddingInfo.detected) {
        return;
      }

      if (originalImage && cropImageWorker.current) {
        try {
          setIsProcessing(true);
          const padding = autoPadding ? paddingInfo.size : 0;
          const crops = await cropImageWithWorker(
            originalImage,
            columns,
            rows,
            padding,
          );
          if (mounted) {
            setCroppedImages(crops);
            setCroppedDataURLs(crops);
          }
        } catch (error) {
          if (mounted) {
            console.error("Image cropping failed:", error);
            setWorkerError(
              error instanceof Error ? error.message : "Unknown error",
            );
          }
        } finally {
          if (mounted) {
            setIsProcessing(false);
          }
        }
      }
    };

    cropImageAsync();

    return () => {
      mounted = false;
    };
  }, [
    originalImage,
    columns,
    rows,
    autoPadding,
    paddingInfo.size,
    paddingInfo.detected,
    cropImageWithWorker,
  ]);

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

      {/* Worker Error Display */}
      {workerError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm font-semibold">Worker Error:</p>
          <p className="text-xs">{workerError}</p>
          <button
            onClick={() => setWorkerError(null)}
            className="mt-2 text-xs underline hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

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
