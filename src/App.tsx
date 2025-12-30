import { useState } from "react";
import { GridTool } from "./components/GridTool";
import { SingleCropTool } from "./components/SingleCropTool";

function App() {
  const [singleImageSrc, setSingleImageSrc] = useState<string | null>(null);
  const [singleImageFileName, setSingleImageFileName] = useState<string>("");

  const handleUseImage = (dataURL: string, fileName: string) => {
    setSingleImageSrc(dataURL);
    setSingleImageFileName(fileName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50/50 to-gray-100/50 p-4 border-b border-gray-100">
            <h1 className="text-xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Smart Image Cropper
            </h1>
          </div>

          <div className="p-4 space-y-4">
            <GridTool onUseImage={handleUseImage} />
            <SingleCropTool
              initialImage={singleImageSrc}
              initialFileName={singleImageFileName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
