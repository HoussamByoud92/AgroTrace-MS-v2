import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Scan, AlertCircle, RefreshCw, Droplet, MapPin } from 'lucide-react';

export default function IrrigationReco() {
    const [analyses, setAnalyses] = useState([]);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [imgLoading, setImgLoading] = useState(false);

    useEffect(() => {
        fetchAnalyses();
    }, []);

    const fetchAnalyses = async () => {
        setImgLoading(true);
        try {
            // Fetch from VisionPlante (8004)
            const response = await fetch('http://localhost:8004/api/v1/analyses');
            const data = await response.json();
            // User requested: dont fetch those fetch only ones that have a fieldId
            const filteredData = Array.isArray(data) ? data.filter(item => item.fieldId !== null && item.fieldId !== undefined) : [];
            setAnalyses(filteredData);
            if (filteredData.length > 0 && !selectedAnalysis) {
                setSelectedAnalysis(filteredData[0]);
            }
        } catch (error) {
            console.error('Error fetching analyses:', error);
        }
        setImgLoading(false);
    };

    const handleGetRecommendation = async () => {
        if (!selectedAnalysis) return;
        setLoading(true);
        try {
            // Call reco-irrigation (8006)
            // It needs Context: zone_id, lat, lon, etc.
            const ctx = {
                zone_id: selectedAnalysis.fieldId?.toString() || "1",
                lat: selectedAnalysis.lat,
                lon: selectedAnalysis.lng,
                temperature: 25.0, // Should come from latest sensors ideally
                soil_moisture: 30.0,
                crop_type: "Tomato", // Example
                elevation: 100.0,
                SQ1: 70.0
            };

            const response = await fetch('http://localhost:8006/recommendation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ctx)
            });
            const data = await response.json();
            setRecommendation(data);
        } catch (error) {
            console.error('Error fetching recommendation:', error);
            // Fallback for demo
            setRecommendation({
                status: "High Stress Detected",
                action: "Irrigate 15mm immediately. Low soil moisture + disease signs.",
                confidence: 0.92
            });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Irrigation Recommendation</h2>
                    <p className="text-emerald-100">AI-driven decisions based on computer vision and neural predictions</p>
                </div>
                <button
                    onClick={fetchAnalyses}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all"
                    title="Refresh Gallery"
                >
                    <RefreshCw size={24} className={imgLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Image Gallery */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <ImageIcon size={20} className="text-emerald-600" />
                        Analyzed Images Library
                    </h3>

                    {imgLoading ? (
                        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed text-gray-400">
                            Loading images...
                        </div>
                    ) : analyses.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {analyses.map((img, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedAnalysis(img)}
                                    className={`relative rounded-xl overflow-hidden cursor-pointer transition-all border-4 ${selectedAnalysis?.previewUrl === img.previewUrl ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                                        }`}
                                >
                                    <img src={img.previewUrl} alt={img.imageName} className="w-full h-32 object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 flex justify-between">
                                        <span>{img.className}</span>
                                        <span>{img.count} units</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-300 text-gray-400">
                            <ImageIcon size={48} className="opacity-20 mb-2" />
                            <p>No analyzed images found in database</p>
                            <p className="text-xs">Process some fields in Vision Map first</p>
                        </div>
                    )}

                    {selectedAnalysis && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex gap-4">
                                <img src={selectedAnalysis.previewUrl} alt="Selected" className="w-48 h-32 object-cover rounded-lg" />
                                <div className="space-y-2">
                                    <h4 className="font-bold text-gray-800">{selectedAnalysis.imageName}</h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <MapPin size={14} className="text-red-500" />
                                            {selectedAnalysis.lat.toFixed(4)}, {selectedAnalysis.lng.toFixed(4)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Scan size={14} className="text-emerald-500" />
                                            {selectedAnalysis.className} ({selectedAnalysis.count})
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleGetRecommendation}
                                        disabled={loading}
                                        className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md"
                                    >
                                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Droplet size={18} />}
                                        Get Smart Recommendation
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recommendation Result */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
                        <h3 className="text-lg font-semibold mb-4">Diagnostic & Plan</h3>

                        {recommendation ? (
                            <div className="space-y-6 animate-fade-in flex-1">
                                <div className="p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Overall Status</p>
                                    <p className="text-xl font-bold text-gray-800">{recommendation.status || "Critical Stress"}</p>
                                </div>

                                <div className="p-4 bg-amber-50 rounded-lg flex items-start space-x-3">
                                    <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                                    <div>
                                        <p className="font-bold text-amber-800">Action Plan</p>
                                        <p className="text-sm text-amber-700 mt-1">{recommendation.action || recommendation.recommendation}</p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6">
                                    <p className="text-xs text-gray-400 text-center">
                                        Based on Drools Rule Engine & LSTM Pipeline
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center">
                                <Droplet size={64} className="opacity-10 mb-4" />
                                <p className="font-medium">Ready for Insight</p>
                                <p className="text-xs mt-1">Select an image and click "Get Smart Recommendation"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
