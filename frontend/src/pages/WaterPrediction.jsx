import React, { useState, useEffect } from 'react';
import { Upload, Play, Database, CheckCircle, Activity, Zap, TrendingUp, Clock, Droplet } from 'lucide-react';

export default function WaterPrediction() {
    const [activeTab, setActiveTab] = useState('predict');
    const [file, setFile] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modelType, setModelType] = useState('lstm');
    const [trainingStatus, setTrainingStatus] = useState(null);
    const [simulationActive, setSimulationActive] = useState(false);
    const [realtimeData, setRealtimeData] = useState([]);
    const [modelInfo, setModelInfo] = useState([]);

    // Form state for all 37 variables
    const [formData, setFormData] = useState({
        fips: '00000',
        lat: 45.0,
        lon: -0.5,
        elevation: 100,
        slope1: 0, slope2: 0, slope3: 0, slope4: 0,
        slope5: 0, slope6: 0, slope7: 0, slope8: 0,
        aspectN: 25, aspectE: 25, aspectS: 25, aspectW: 25, aspectUnknown: 0,
        WAT_LAND: 5, NVG_LAND: 10, URB_LAND: 5, GRS_LAND: 20,
        FOR_LAND: 10, CULTRF_LAND: 20, CULTIR_LAND: 20, CULT_LAND: 10,
        SQ1: 70, SQ2: 65, SQ3: 60, SQ4: 55, SQ5: 50, SQ6: 45, SQ7: 40
    });

    // Fetch latest sensor data on mount
    useEffect(() => {
        fetchLatestSensorData();
        fetchModelInfo();
        checkTrainingStatus();
        checkSimulationStatus(); // Check if simulation is already running
    }, []);

    // Poll for real-time data when simulation is active
    useEffect(() => {
        let interval;
        if (simulationActive) {
            interval = setInterval(() => {
                fetchRecentReadings();
                checkSimulationStatus(); // Verify simulation is still running
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [simulationActive]);

    const fetchLatestSensorData = async () => {
        try {
            const response = await fetch('http://localhost:8002/latest-sensor-data');
            const data = await response.json();
            setFormData(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error('Error fetching sensor data:', error);
        }
    };

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

    const fetchRecentReadings = async () => {
        try {
            const response = await fetch('http://localhost:8002/simulate/generate-full?count=10');
            const data = await response.json();
            setRealtimeData(data);
        } catch (error) {
            console.error('Error fetching recent readings:', error);
        }
    };

    const checkSimulationStatus = async () => {
        try {
            const response = await fetch('http://localhost:8002/simulate/status');
            const data = await response.json();
            setSimulationActive(data.is_active);
        } catch (error) {
            console.error('Error checking simulation status:', error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handlePredict = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            // First refresh data
            await fetchLatestSensorData();

            const response = await fetch(`http://localhost:8003/predict?model_type=${modelType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            setPrediction(data);
        } catch (error) {
            console.error('Prediction error:', error);
            alert('Prediction failed. Please ensure the model is trained.');
        }
        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setLoading(true);

        const formData = new FormData();
        formData.append('file', uploadedFile);


        try {
            const response = await fetch(`http://localhost:8003/train/upload?model_type=both`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Training request failed');
            }

            const result = await response.json();

            // Check if results exist
            if (!result.results) {
                throw new Error('Training completed but no results returned');
            }

            // Build success message
            let message = `Training completed! Processed ${result.rows_processed} rows.\n`;
            if (result.results.lstm) {
                message += `LSTM - Accuracy: ${(result.results.lstm.accuracy * 100).toFixed(1)}%, Version: ${result.results.lstm.version}\n`;
            }
            if (result.results.prophet) {
                message += `Prophet - Accuracy: ${(result.results.prophet.accuracy * 100).toFixed(1)}%, Version: ${result.results.prophet.version}`;
            }

            alert(message);
            fetchModelInfo();
        } catch (error) {
            console.error('Training error:', error);
            alert('Training failed: ' + error.message);
        }

        setLoading(false);
    };

    const toggleSimulation = async () => {
        try {
            const endpoint = simulationActive ? '/simulate/stop' : '/simulate/start';
            await fetch(`http://localhost:8002${endpoint}`, { method: 'POST' });
            setSimulationActive(!simulationActive);
        } catch (error) {
            console.error('Simulation toggle error:', error);
        }
    };

    const InputField = ({ label, field, type = "number", step = "0.01", min, max }) => (
        <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
            <input
                type={type}
                value={formData[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
                step={step}
                min={min}
                max={max}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none text-sm"
            />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header with Model Info */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-xl shadow-lg text-center">
                <h2 className="text-3xl font-bold mb-2">Water Need Prediction</h2>
                <p className="text-blue-100 mb-4">Click below to get recommendations based on real-time sensor data</p>
                <div className="flex justify-center gap-4">
                    {modelInfo.map((model, idx) => (
                        <div key={idx} className="bg-white/20 backdrop-blur-sm px-6 py-2 rounded-lg">
                            <div className="text-xs text-blue-100">{model.model_type}</div>
                            <div className="font-semibold">
                                {model.is_loaded ? `${(model.accuracy * 100).toFixed(1)}% Accuracy` : 'Not Trained'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-8 py-10">
                <button
                    onClick={handlePredict}
                    disabled={loading}
                    className="group relative w-64 h-64 bg-white rounded-full shadow-2xl border-8 border-blue-500 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:grayscale"
                >
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
                    <Droplet size={80} className={`text-blue-600 mb-2 ${loading ? 'animate-bounce' : ''}`} />
                    <span className="text-gray-800 font-bold text-lg uppercase tracking-wider">
                        {loading ? 'Analyzing...' : 'Predict Need Water'}
                    </span>
                </button>

                {prediction && (
                    <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <h3 className="text-gray-500 text-sm font-medium mb-1">Water Needed</h3>
                            <div className="text-4xl font-black text-blue-600">
                                {prediction.predicted_water_need_mm} <span className="text-xl">mm</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <h3 className="text-gray-500 text-sm font-medium mb-1">Duration</h3>
                            <div className="text-4xl font-black text-green-600">
                                {prediction.irrigation_duration_hours} <span className="text-xl">h</span>
                            </div>
                        </div>
                        <div className="md:col-span-2 bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-2xl border border-blue-100 text-center">
                            <Activity size={24} className="mx-auto mb-2 text-blue-500" />
                            <p className="text-lg font-medium text-gray-800">{prediction.recommendation}</p>
                            <div className="text-xs text-gray-400 mt-4">
                                Confidence Level: {(prediction.confidence * 100).toFixed(0)}% | Model: {prediction.model_used}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Simulation Link */}
            <div className="text-center text-sm text-gray-400">
                Data is fetched from the <a href="/sensors" className="underline hover:text-blue-500">Live Simulation Service</a>
            </div>
        </div>
    );
}
