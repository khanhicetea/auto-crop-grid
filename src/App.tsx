import JSZip from "jszip";
import { Download, Image as ImageIcon, RefreshCw, Upload } from "lucide-react";
import React, { useEffect, useState } from "react";

interface Preset {
  cols: number;
  rows: number;
  label: string;
}

function App() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [croppedImages, setCroppedImages] = useState<string[]>([]);
  const [croppedDataURLs, setCroppedDataURLs] = useState<string[]>([]);
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [columns, setColumns] = useState<number>(3);
  const [rows, setRows] = useState<number>(3);

  // Auto-crop when originalImage, columns, or rows change
  useEffect(() => {
    if (originalImage) {
      cropImage(originalImage, columns, rows);
    }
  }, [originalImage, columns, rows]);

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
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const cropImage = (img: HTMLImageElement, cols: number, rows: number) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = img.width;
    const H = img.height;
    const crops: string[] = [];
    const totalCrops = cols * rows;

    for (let i = 0; i < totalCrops; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const quad = {
        x: col * (W / cols),
        y: row * (H / rows),
        w: W / cols,
        h: H / rows,
      };

      canvas.width = quad.w;
      canvas.height = quad.h;
      ctx.drawImage(img, quad.x, quad.y, quad.w, quad.h, 0, 0, quad.w, quad.h);
      crops.push(canvas.toDataURL());
    }

    setCroppedImages(crops);
    setCroppedDataURLs(crops);
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

  const presets: Preset[] = [
    { cols: 1, rows: 1, label: "1×1" },
    { cols: 2, rows: 2, label: "2×2" },
    { cols: 3, rows: 3, label: "3×3" },
    { cols: 4, rows: 4, label: "4×4" },
    { cols: 2, rows: 3, label: "2×3" },
    { cols: 3, rows: 4, label: "3×4" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Content Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Controls Section */}
          <div className="bg-gradient-to-r from-indigo-50/50 to-blue-50/50 p-4 border-b border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* File Upload with Header */}
              <div>
                <div className="mb-3">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Image Grid Cropper
                  </h1>
                  <p className="text-xs text-gray-500">
                    Upload & crop into grid
                  </p>
                </div>
              </div>

              {/* Custom Grid Inputs */}
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
                    className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                    className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Quick Presets */}
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
                          ? "bg-indigo-600 text-white shadow-md scale-105"
                          : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4">
            {isProcessing && (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-indigo-200 border-t-indigo-600"></div>
                <p className="mt-3 text-sm text-gray-600 font-medium">
                  Processing image...
                </p>
              </div>
            )}

            {!isProcessing && originalImage && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Original Image Preview */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-gray-700">
                      Original
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        {originalImage.width} × {originalImage.height}
                      </span>
                      <input
                        id="file-upload-change"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-upload-change"
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded cursor-pointer transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Change
                      </label>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                    <img
                      src={originalImage.src}
                      alt="Original"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Cropped Frames */}
                {croppedImages.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-gray-700">
                        Cropped Frames ({croppedImages.length})
                      </h2>
                      <button
                        onClick={downloadZip}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download ZIP
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(columns, 4)}, minmax(0, 1fr))`,
                        }}
                      >
                        {croppedImages.map((src, i) => (
                          <div
                            key={i}
                            className="relative group bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-300 transition-all"
                          >
                            <img
                              src={src}
                              alt={`Crop ${i + 1}`}
                              className="w-full h-auto"
                            />
                            <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-sm">
                              {i + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isProcessing && !originalImage && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-3">
                  <ImageIcon className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-sm text-gray-500 font-medium mb-3">
                  Upload an image to get started
                </p>
                <input
                  id="file-upload-empty"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload-empty"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95"
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
        </div>
      </div>
    </div>
  );
}

export default App;
