import React, { useState } from 'react';
import { Image as ImageIcon, Upload, Scan, AlertCircle } from 'lucide-react';

export default function IrrigationReco() {
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setResult(null);
        }
    };

    const handleAnalyze = () => {
        setLoading(true);
        // Simulate API analysis
        setTimeout(() => {
            setResult({
                status: "Diseased (Mild)",
                confidence: 0.88,
                action: "Apply Fungicide A - Urgent"
            });
            setLoading(false);
        }, 2000);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4">Plant Image Analysis</h3>

                {!preview ? (
                    <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <ImageIcon size={48} className="text-gray-300 mb-2" />
                        <span className="text-gray-600 font-medium">Upload Plant Image</span>
                        <span className="text-sm text-gray-400 mt-1">JPG, PNG supported</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                ) : (
                    <div className="relative rounded-xl overflow-hidden shadow-md">
                        <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
                        <button
                            onClick={() => { setPreview(null); setImage(null); setResult(null); }}
                            className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-gray-700 hover:text-red-500"
                        >
                            <Upload size={16} />
                        </button>
                    </div>
                )}

                <button
                    onClick={handleAnalyze}
                    disabled={!image || loading}
                    className={`mt-6 w-full py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors ${!image ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                >
                    {loading ? <span>Scanning...</span> : <> <Scan size={20} /> <span>Analyze Health</span> </>}
                </button>
            </div>

            {/* Results Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <h3 className="text-lg font-semibold mb-6">Diagnostic Results</h3>

                    {result ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className={`p-4 rounded-lg border-l-4 ${result.status.includes("Healthy") ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Health Status</p>
                                <p className="text-2xl font-bold text-gray-800">{result.status}</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500 mb-2">Confidence Level</p>
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{ width: `${result.confidence * 100}%` }}></div>
                                </div>
                                <p className="text-right text-xs text-gray-500 mt-1">{(result.confidence * 100).toFixed(0)}%</p>
                            </div>

                            <div className="p-4 bg-orange-50 rounded-lg flex items-start space-x-3">
                                <AlertCircle className="text-orange-500 shrink-0" size={20} />
                                <div>
                                    <p className="font-semibold text-orange-800">Recommendation</p>
                                    <p className="text-sm text-orange-700 mt-1">{result.action}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-400 flex-col">
                            <Scan size={48} className="opacity-20 mb-2" />
                            <p>Upload an image to see diagnostics</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t">
                    <button className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        Correct this prediction (Train)
                    </button>
                </div>
            </div>
        </div>
    );
}
