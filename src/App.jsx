import JSZip from "jszip";
import React, { useEffect, useState } from "react";

function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [croppedDataURLs, setCroppedDataURLs] = useState([]);
  const [originalFileName, setOriginalFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(2);

  // Auto-crop when originalImage, columns, or rows change
  useEffect(() => {
    if (originalImage) {
      cropImage(originalImage, columns, rows);
    }
  }, [originalImage, columns, rows]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setOriginalFileName(file.name);
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setOriginalImage(img);
          setIsProcessing(false);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const cropImage = (img, cols, rows) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const W = img.width;
    const H = img.height;
    const crops = [];
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

  const dataURLToBlob = (dataURL) => {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            Image Grid Cropper
          </h1>
          <p className="text-lg text-gray-600">
            Upload an image and automatically crop it into a custom grid layout
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Input and Original Image */}
            <div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose an image file
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors duration-200"
                />
              </div>

              {/* Preset Grid Buttons */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { cols: 1, rows: 1, label: "1×1" },
                    { cols: 2, rows: 2, label: "2×2" },
                    { cols: 3, rows: 3, label: "3×3" },
                    { cols: 4, rows: 4, label: "4×4" },
                    { cols: 2, rows: 3, label: "2×3" },
                    { cols: 3, rows: 4, label: "3×4" },
                  ].map((preset) => (
                    <button
                      key={`${preset.cols}x${preset.rows}`}
                      onClick={() => {
                        setColumns(preset.cols);
                        setRows(preset.rows);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        columns === preset.cols && rows === preset.rows
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Columns
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={columns}
                    onChange={(e) => {
                      const newCols = parseInt(e.target.value) || 1;
                      setColumns(newCols);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rows
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rows}
                    onChange={(e) => {
                      const newRows = parseInt(e.target.value) || 1;
                      setRows(newRows);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {isProcessing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-gray-600">Processing image...</p>
                </div>
              )}

              {originalImage && !isProcessing && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Original Image
                  </h2>
                  <div className="flex justify-center">
                    <img
                      src={originalImage.src}
                      alt="Original"
                      className="max-w-full h-auto border-2 border-gray-200 rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Results and Download */}
            <div>
              {croppedImages.length > 0 && !isProcessing && (
                <div>
                  <div className="text-center mb-10">
                    <button
                      type="button"
                      onClick={downloadZip}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Download All Frames as ZIP
                    </button>
                  </div>

                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Cropped Frames
                  </h2>
                  <div
                    className={`grid grid-cols-${Math.min(columns, 4)} gap-4 mb-6`}
                  >
                    {croppedImages.map((src, i) => (
                      <div
                        key={i}
                        className="relative bg-gray-50 rounded-lg p-2"
                      >
                        <img
                          src={src}
                          alt={`Crop ${i + 1}`}
                          className="w-full h-auto object-cover border rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                        />
                        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white text-sm font-bold px-2 py-1 rounded">
                          {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>Supported formats: JPG, PNG, GIF, WebP</p>
        </div>
      </div>
    </div>
  );
}

export default App;
