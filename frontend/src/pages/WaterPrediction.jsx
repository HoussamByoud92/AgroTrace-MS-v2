import React, { useState, useEffect } from 'react';
import { Upload, Play, Database, CheckCircle, Activity, Zap, TrendingUp, Clock, Droplet, RefreshCw } from 'lucide-react';

export default function WaterPrediction() {
    const [activeTab, setActiveTab] = useState('predict');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState(null);
    const [modelInfo, setModelInfo] = useState([]);

    // Simplified form state for weather data
    const [formData, setFormData] = useState({
        temperature: 22.0,
        humidity: 60.0,
        pressure: 1013.25,
        wind_speed: 2.5,
        dew_point: 15.0
    });

    useEffect(() => {
        fetchModelInfo();
        checkTrainingStatus();
        
        // Check if there's sensor data from the sensors page
        const sensorData = localStorage.getItem('sensorDataForPrediction');
        if (sensorData) {
            const data = JSON.parse(sensorData);
            setFormData(data);
            localStorage.removeItem('sensorDataForPrediction'); // Clear after use
            // Auto-predict with the received data
            setTimeout(() => handlePredict(), 500);
        }
    }, []);

    const fetchModelInfo = async () => {
        try {
            const response = await fetch('http://localhost:8003/models/info');
            const data = await response.json();
            setModelInfo(data);
        } catch (error) {
            console.error('Error fetching model info:', error);
        }
    };

    const checkTrainingStatus = async () => {
        try {
            const response = await fetch('http://localhost:8003/train/status');
            const data = await response.json();
            setTrainingStatus(data);
        } catch (error) {
            console.error('Error checking training status:', error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handlePredict = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8003/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Prediction failed');
            }

            const result = await response.json();
            setPrediction(result);
        } catch (error) {
            console.error('Prediction error:', error);
            alert(`Prediction failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTrain = async () => {
        try {
            const response = await fetch('http://localhost:8003/train', {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Training failed');
            }

            const result = await response.json();
            alert('Training completed successfully!');
            fetchModelInfo();
        } catch (error) {
            console.error('Training error:', error);
            alert(`Training failed: ${error.message}`);
        }
    };

    const loadRandomData = async () => {
        try {
            const response = await fetch('http://localhost:8003/random-sensor-data');
            const data = await response.json();
            setFormData(data);
        } catch (error) {
            console.error('Error loading random data:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Water Prediction System</h2>
                <p className="text-blue-100">AI-powered irrigation forecasting using LSTM neural networks</p>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('predict')}
                        className={`px-6 py-4 font-medium text-sm ${activeTab === 'predict'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Droplet className="inline mr-2" size={16} />
                        Water Prediction
                    </button>
                    <button
                        onClick={() => setActiveTab('train')}
                        className={`px-6 py-4 font-medium text-sm ${activeTab === 'train'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database className="inline mr-2" size={16} />
                        Model Training
                    </button>
                </div>

                {/* Prediction Tab */}
                {activeTab === 'predict' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Input Form */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-800">Weather Input Data</h3>
                                    <button
                                        onClick={loadRandomData}
                                        className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                    >
                                        <RefreshCw size={14} />
                                        <span>Load Random</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Temperature (°C)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.temperature}
                                            onChange={(e) => handleInputChange('temperature', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Humidity (%)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.humidity}
                                            onChange={(e) => handleInputChange('humidity', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pressure (mbar)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.pressure}
                                            onChange={(e) => handleInputChange('pressure', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Wind Speed (m/s)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.wind_speed}
                                            onChange={(e) => handleInputChange('wind_speed', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Dew Point (°C)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.dew_point}
                                            onChange={(e) => handleInputChange('dew_point', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePredict}
                                    disabled={loading}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Predicting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={16} />
                                            <span>Predict Water Need</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Results */}
                            <div className="space-y-6">
                                {prediction && (
                                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Prediction Results</h3>
                                        
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="text-center">
                                            
                                                
                                            </div>
                                           
                                               
                                        </div>

                                        <div className="space-y-3">
                                         
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Model:</span>
                                                <span className="font-semibold">{prediction.model_used}</span>
                                            </div>
                                        
                                        </div>

                                        {/* 3-Day Forecast */}
                                        {prediction.forecast_days && prediction.forecast_days.length > 0 && (
                                            <div className="mt-6 pt-6 border-t border-blue-200">
                                                <h4 className="font-semibold text-gray-800 mb-3">3-Day Forecast</h4>
                                                <div className="space-y-2">
                                                    {prediction.forecast_days.map((day, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                                            <div>
                                                                <div className="font-medium">Day {day.day} ({day.date})</div>
                                                                <div className="text-sm text-gray-600">{day.temperature}°C, {day.humidity}% humidity</div>
                                                            </div>
                                                        
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Model Status */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-gray-800 mb-3">Model Status</h4>
                                    {modelInfo.map((model, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2">
                                            <div>
                                                <span className="font-medium">{model.model_type}</span>
                                                <span className="text-sm text-gray-500 ml-2">v{model.version}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm">{(model.accuracy * 100).toFixed(1)}%</span>
                                                <div className={`w-2 h-2 rounded-full ${model.is_loaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Training Tab */}
                {activeTab === 'train' && (
                    <div className="p-6">
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Train LSTM Model</h3>
                                <p className="text-gray-600">Train the model using weather data from data.csv</p>
                            </div>

                            {trainingStatus && (
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">Training Status</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            trainingStatus.is_training ? 'bg-blue-100 text-blue-700' : 
                                            trainingStatus.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {trainingStatus.status}
                                        </span>
                                    </div>
                                    {trainingStatus.is_training && (
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${trainingStatus.progress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleTrain}
                                disabled={trainingStatus?.is_training}
                                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                <Database size={16} />
                                <span>Train Model with data.csv</span>
                            </button>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h4 className="font-medium text-blue-800 mb-2">Training Information</h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Uses weather data from data.csv file</li>
                                    <li>• Converts weather data to agricultural features</li>
                                    <li>• Trains LSTM neural network for water prediction</li>
                                    <li>• Model is automatically saved and persisted</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}