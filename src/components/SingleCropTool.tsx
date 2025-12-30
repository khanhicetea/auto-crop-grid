import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Scissors, Upload } from "lucide-react";

interface RatioPreset {
  ratio: number;
  label: string;
}

interface SingleCropToolProps {
  initialImage?: string | null;
  initialFileName?: string;
}

export function SingleCropTool({ initialImage, initialFileName }: SingleCropToolProps) {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
    null
  );
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const [originalDataURL, setOriginalDataURL] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState({
    x: 50,
    y: 50,
    width: 200,
    height: 200,
  });
  const [aspectRatio, setAspectRatio] = useState<number | null>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>("");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [boxStart, setBoxStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [cropResult, setCropResult] = useState<string | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (initialImage && initialFileName) {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setOriginalDataURL(initialImage);
        setOriginalFileName(initialFileName);
        const maxSize = Math.min(img.width, img.height) * 0.6;
        const ratio = aspectRatio || 1;
        const height = maxSize / ratio;
        setCropBox({
          x: (img.width - maxSize) / 2,
          y: (img.height - maxSize) / 2,
          width: maxSize,
          height: height,
        });
        setCropResult(null);
      };
      img.src = initialImage;
    }
  }, [initialImage, initialFileName]);

  const ratioPresets: RatioPreset[] = [
    { ratio: 1, label: "1:1" },
    { ratio: 4 / 3, label: "4:3" },
    { ratio: 3 / 4, label: "3:4" },
    { ratio: 16 / 9, label: "16:9" },
    { ratio: 9 / 16, label: "9:16" },
    { ratio: 3 / 2, label: "3:2" },
    { ratio: 2 / 3, label: "2:3" },
    { ratio: 21 / 9, label: "21:9" },
    { ratio: 9 / 21, label: "9:21" },
    { ratio: 5 / 4, label: "5:4" },
    { ratio: 4 / 5, label: "4:5" },
    { ratio: 0, label: "Free" },
  ];

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
            setOriginalDataURL(result);
            const maxSize = Math.min(img.width, img.height) * 0.6;
            const ratio = aspectRatio || 1;
            const height = maxSize / ratio;
            setCropBox({
              x: (img.width - maxSize) / 2,
              y: (img.height - maxSize) / 2,
              width: maxSize,
              height: height,
            });
            setCropResult(null);
            setIsProcessing(false);
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

  const downloadCroppedImage = () => {
    if (cropResult) {
      const blob = dataURLToBlob(cropResult);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = originalFileName.replace(/\.[^/.]+$/, "");
      a.download = `${baseName}-cropped.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!originalImage) return;
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const img = imageRef.current;
    if (!img) return;

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const handleSize = 20 * scaleX;

    const handles = [
      { name: "nw", x: cropBox.x, y: cropBox.y },
      { name: "n", x: cropBox.x + cropBox.width / 2, y: cropBox.y },
      { name: "ne", x: cropBox.x + cropBox.width, y: cropBox.y },
      { name: "e", x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height / 2 },
      { name: "se", x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height },
      { name: "s", x: cropBox.x + cropBox.width / 2, y: cropBox.y + cropBox.height },
      { name: "sw", x: cropBox.x, y: cropBox.y + cropBox.height },
      { name: "w", x: cropBox.x, y: cropBox.y + cropBox.height / 2 },
    ];

    for (const handle of handles) {
      if (
        mouseX >= handle.x - handleSize &&
        mouseX <= handle.x + handleSize &&
        mouseY >= handle.y - handleSize &&
        mouseY <= handle.y + handleSize
      ) {
        setIsResizing(true);
        setResizeHandle(handle.name);
        setDragStart({ x: mouseX, y: mouseY });
        setBoxStart({ ...cropBox });
        return;
      }
    }

    if (
      mouseX >= cropBox.x &&
      mouseX <= cropBox.x + cropBox.width &&
      mouseY >= cropBox.y &&
      mouseY <= cropBox.y + cropBox.height
    ) {
      setIsDragging(true);
      setDragStart({ x: mouseX, y: mouseY });
      setBoxStart({ ...cropBox });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!originalImage) return;
    if (!isDragging && !isResizing) return;

    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const img = imageRef.current;
    if (!img) return;

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isDragging) {
      const dx = mouseX - dragStart.x;
      const dy = mouseY - dragStart.y;

      let newX = boxStart.x + dx;
      let newY = boxStart.y + dy;

      newX = Math.max(0, Math.min(newX, originalImage.width - boxStart.width));
      newY = Math.max(0, Math.min(newY, originalImage.height - boxStart.height));

      setCropBox({
        ...cropBox,
        x: newX,
        y: newY,
      });
    }

    if (isResizing) {
      const dx = mouseX - dragStart.x;
      const dy = mouseY - dragStart.y;

      let newX = boxStart.x;
      let newY = boxStart.y;
      let newWidth = boxStart.width;
      let newHeight = boxStart.height;

      if (resizeHandle.includes("e")) {
        newWidth = Math.max(50, boxStart.width + dx);
      }
      if (resizeHandle.includes("w")) {
        const potentialWidth = Math.max(50, boxStart.width - dx);
        if (potentialWidth > 50) {
          newWidth = potentialWidth;
          newX = boxStart.x + dx;
        }
      }
      if (resizeHandle.includes("s")) {
        newHeight = Math.max(50, boxStart.height + dy);
      }
      if (resizeHandle.includes("n")) {
        const potentialHeight = Math.max(50, boxStart.height - dy);
        if (potentialHeight > 50) {
          newHeight = potentialHeight;
          newY = boxStart.y + dy;
        }
      }

      if (aspectRatio && aspectRatio > 0) {
        if (resizeHandle === "se" || resizeHandle === "nw") {
          const newSize = Math.min(newWidth, newHeight);
          newWidth = newSize;
          newHeight = newSize / aspectRatio;
          if (resizeHandle === "nw") {
            newX = boxStart.x + boxStart.width - newWidth;
            newY = boxStart.y + boxStart.height - newHeight;
          }
        } else if (resizeHandle === "sw" || resizeHandle === "ne") {
          const newSize = Math.min(newWidth, newHeight);
          newWidth = newSize;
          newHeight = newSize / aspectRatio;
          if (resizeHandle === "sw") {
            newX = boxStart.x + boxStart.width - newWidth;
          }
          if (resizeHandle === "ne") {
            newY = boxStart.y + boxStart.height - newHeight;
          }
        } else if (resizeHandle === "e" || resizeHandle === "w") {
          newHeight = newWidth / aspectRatio;
          if (resizeHandle === "w") {
            newX = boxStart.x + boxStart.width - newWidth;
          }
        } else if (resizeHandle === "n" || resizeHandle === "s") {
          newWidth = newHeight * aspectRatio;
          if (resizeHandle === "n") {
            newY = boxStart.y + boxStart.height - newHeight;
          }
        }
      }

      newX = Math.max(0, Math.min(newX, originalImage.width - newWidth));
      newY = Math.max(0, Math.min(newY, originalImage.height - newHeight));
      newWidth = Math.max(50, Math.min(newWidth, originalImage.width - newX));
      newHeight = Math.max(50, Math.min(newHeight, originalImage.height - newY));

      setCropBox({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle("");
  };

  const performCrop = useCallback(() => {
    if (!originalImage) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cropBox.width;
    canvas.height = cropBox.height;

    ctx.drawImage(
      originalImage,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      cropBox.width,
      cropBox.height
    );

    setCropResult(canvas.toDataURL());
  }, [originalImage, cropBox]);

  useEffect(() => {
    performCrop();
  }, [cropBox, originalImage, performCrop]);

  const handleRatioChange = (ratio: number) => {
    setAspectRatio(ratio);
    if (originalImage && ratio > 0) {
      const centerX = cropBox.x + cropBox.width / 2;
      const centerY = cropBox.y + cropBox.height / 2;
      const size = Math.min(cropBox.width, cropBox.height);
      const newHeight = size / ratio;

      setCropBox({
        x: centerX - size / 2,
        y: centerY - newHeight / 2,
        width: size,
        height: newHeight,
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 mt-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Single Crop Tool</h2>
        <p className="text-xs text-gray-500">Drag & resize to crop a region</p>
      </div>

      {isProcessing && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-gray-600"></div>
          <p className="mt-3 text-sm text-gray-600 font-medium">Processing image...</p>
        </div>
      )}

      {!isProcessing && !originalImage && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-3">
            <Scissors className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 font-medium mb-3">
            Upload an image to crop
          </p>
          <input
            id="single-file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="single-file-upload"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Choose Image
          </label>
          <p className="text-xs text-gray-400 mt-3">Supports JPG, PNG, GIF, WebP</p>
        </div>
      )}

      {!isProcessing && originalImage && (
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            {ratioPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleRatioChange(preset.ratio)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  (aspectRatio === 0 && preset.ratio === 0) ||
                  (aspectRatio === preset.ratio && preset.ratio !== 0)
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-700">Source Image</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {originalImage.width} × {originalImage.height}
                  </span>
                  <input
                    id="single-file-change"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="single-file-change"
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-2 py-1 rounded cursor-pointer transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Change
                  </label>
                </div>
              </div>
              <div
                ref={imageContainerRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden cursor-crosshair select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={originalDataURL}
                  alt="Source"
                  className="w-full h-auto block"
                  draggable={false}
                />
                <div
                  className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing"
                  style={{
                    left: `${(cropBox.x / originalImage.width) * 100}%`,
                    top: `${(cropBox.y / originalImage.height) * 100}%`,
                    width: `${(cropBox.width / originalImage.width) * 100}%`,
                    height: `${(cropBox.height / originalImage.height) * 100}%`,
                  }}
                >
                  <div className="absolute top-0 left-0 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize rounded-full" />
                  <div className="absolute top-0 left-1/2 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 -translate-y-1/2 cursor-n-resize rounded-full" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-2 border-white bg-black/50 translate-x-1/2 -translate-y-1/2 cursor-ne-resize rounded-full" />
                  <div className="absolute top-1/2 right-0 w-4 h-4 border-2 border-white bg-black/50 translate-x-1/2 -translate-y-1/2 cursor-e-resize rounded-full" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-2 border-white bg-black/50 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-full" />
                  <div className="absolute bottom-0 left-1/2 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 translate-y-1/2 cursor-s-resize rounded-full" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 translate-y-1/2 cursor-sw-resize rounded-full" />
                  <div className="absolute top-1/2 left-0 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 -translate-y-1/2 cursor-w-resize rounded-full" />
                  <div className="absolute top-1/2 left-1/2 w-4 h-4 border-2 border-white bg-black/50 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-700">Cropped Result</h3>
                  <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {Math.round(cropBox.width)} × {Math.round(cropBox.height)}
                  </span>
                </div>
                {cropResult && (
                  <button
                    onClick={downloadCroppedImage}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                )}
              </div>
              {cropResult ? (
                <img
                  src={cropResult}
                  alt="Cropped"
                  className="w-full max-h-[100dvh] object-contain rounded-lg"
                />
              ) : (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No preview available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
