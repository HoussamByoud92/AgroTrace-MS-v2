import React, { useState } from 'react';
import { Upload, Play, Database, CheckCircle, FileText } from 'lucide-react';

export default function WaterPrediction() {
    const [activeTab, setActiveTab] = useState('predict');
    const [file, setFile] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setPrediction({
                need: 45.2,
                unit: 'mm',
                confidence: 0.92,
                recommendation: "Irrigation Recommended"
            });
            setLoading(false);
        }, 1500);
    };

    const handleTrain = () => {
        alert("Training initiated! Check logs.");
    };

    return (
        <div className="space-y-6">

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('predict')}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'predict' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Prediction Interface
                </button>
                <button
                    onClick={() => setActiveTab('train')}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'train' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Model Training
                </button>
            </div>

            {activeTab === 'predict' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-4">Input Parameters</h3>
                        <form onSubmit={handlePredict} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Latitude</label>
                                    <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none" defaultValue="45.23" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Longitude</label>
                                    <input type="text" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none" defaultValue="-0.55" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Soil Quality Index (SQ1)</label>
                                <input type="range" min="0" max="100" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>Low</span>
                                    <span>High</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Weather Context</label>
                                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
                                    Data fetched automatically from weather service.
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                {loading ? <span>Processing...</span> : <> <Play size={18} /> <span>Predict Water Need</span> </>}
                            </button>
                        </form>
                    </div>

                    {prediction && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center animate-fade-in">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-4xl font-bold text-gray-800">{prediction.need} <span className="text-xl text-gray-500">{prediction.unit}</span></h2>
                            <p className="text-gray-500 mt-1">Confidence Score: {(prediction.confidence * 100).toFixed(0)}%</p>

                            <div className="mt-6 px-4 py-2 bg-green-50 text-green-700 rounded-full font-medium">
                                {prediction.recommendation}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl">
                    <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Database size={20} className="text-green-600" />
                        <span>Dataset Upload</span>
                    </h3>
                    <p className="text-gray-500 mb-6 text-sm">Upload a CSV file containing historical crop, weather, and irrigation data to retrain the model.</p>

                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-green-500 transition-colors cursor-pointer group">
                        <div className="p-4 bg-gray-50 rounded-full mb-3 group-hover:bg-green-50">
                            <Upload size={24} className="text-gray-400 group-hover:text-green-600" />
                        </div>
                        <p className="font-medium text-gray-700">Click to upload CSV</p>
                        <p className="text-xs text-gray-400 mt-1">Max file size: 50MB</p>
                        <input type="file" className="hidden" />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleTrain}
                            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Start Training
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
