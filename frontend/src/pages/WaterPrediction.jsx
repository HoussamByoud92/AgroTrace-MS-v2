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
            const response = await fetch('http://localhost:8003/latest-sensor-data');
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
            const response = await fetch('http://localhost:8002/recent?limit=10');
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
        e.preventDefault();
        setLoading(true);
        try {
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
            <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Water Need Prediction System</h2>
                <p className="text-blue-100 mb-4">AI-powered irrigation planning with LSTM & Prophet models</p>
                <div className="flex gap-4">
                    {modelInfo.map((model, idx) => (
                        <div key={idx} className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                            <div className="text-xs text-blue-100">{model.model_type}</div>
                            <div className="font-semibold">
                                {model.is_loaded ? `${(model.accuracy * 100).toFixed(1)}% Accuracy` : 'Not Trained'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('predict')}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'predict' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Play size={16} className="inline mr-1" />
                    Prediction
                </button>
                <button
                    onClick={() => setActiveTab('train')}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'train' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Database size={16} className="inline mr-1" />
                    Training
                </button>
                <button
                    onClick={() => setActiveTab('simulation')}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'simulation' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Activity size={16} className="inline mr-1" />
                    Data Simulation
                </button>
            </div>

            {/* PREDICTION TAB */}
            {activeTab === 'predict' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Form */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Input Parameters</h3>
                            <button
                                onClick={fetchLatestSensorData}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                <Zap size={14} />
                                Load Latest Data
                            </button>
                        </div>

                        <form onSubmit={handlePredict} className="space-y-6">
                            {/* Location Section */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    Location & Elevation
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <InputField label="FIPS Code" field="fips" type="text" />
                                    <InputField label="Latitude" field="lat" step="0.0001" />
                                    <InputField label="Longitude" field="lon" step="0.0001" />
                                    <InputField label="Elevation (m)" field="elevation" />
                                </div>
                            </div>

                            {/* Slope Section */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    Slope (8 Directions)
                                </h4>
                                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <InputField key={i} label={`S${i}`} field={`slope${i}`} step="0.1" />
                                    ))}
                                </div>
                            </div>

                            {/* Aspect Section */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                    Aspect Distribution (%)
                                </h4>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                    <InputField label="North" field="aspectN" max="100" />
                                    <InputField label="East" field="aspectE" max="100" />
                                    <InputField label="South" field="aspectS" max="100" />
                                    <InputField label="West" field="aspectW" max="100" />
                                    <InputField label="Unknown" field="aspectUnknown" max="100" />
                                </div>
                            </div>

                            {/* Land Cover Section */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    Land Cover (%)
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <InputField label="Water" field="WAT_LAND" max="100" />
                                    <InputField label="Non-Veg" field="NVG_LAND" max="100" />
                                    <InputField label="Urban" field="URB_LAND" max="100" />
                                    <InputField label="Grassland" field="GRS_LAND" max="100" />
                                    <InputField label="Forest" field="FOR_LAND" max="100" />
                                    <InputField label="Cult-Rainfed" field="CULTRF_LAND" max="100" />
                                    <InputField label="Cult-Irrigated" field="CULTIR_LAND" max="100" />
                                    <InputField label="Cultivated" field="CULT_LAND" max="100" />
                                </div>
                            </div>

                            {/* Soil Quality Section */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    Soil Quality Indices
                                </h4>
                                <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                        <InputField key={i} label={`SQ${i}`} field={`SQ${i}`} max="100" />
                                    ))}
                                </div>
                            </div>

                            {/* Model Selection & Submit */}
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Prediction Model</label>
                                    <select
                                        value={modelType}
                                        onChange={(e) => setModelType(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="lstm">LSTM Neural Network</option>
                                        <option value="prophet">Prophet Time Series</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg"
                                >
                                    {loading ? <span>Processing...</span> : <><Play size={18} /> <span>Predict Water Need</span></>}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Prediction Results */}
                    <div className="lg:col-span-1">
                        {prediction ? (
                            <div className="bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-xl shadow-lg border border-blue-100 animate-fade-in">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 text-white rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
                                        <Droplet size={32} />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-600 mb-2">Predicted Water Need</h3>
                                    <div className="text-5xl font-bold text-gray-800 mb-1">
                                        {prediction.predicted_water_need_mm}
                                        <span className="text-xl text-gray-500 ml-2">mm</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-600 flex items-center gap-2">
                                                <Clock size={16} className="text-blue-500" />
                                                Irrigation Duration
                                            </span>
                                            <span className="font-bold text-gray-800">{prediction.irrigation_duration_hours}h</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-600 flex items-center gap-2">
                                                <TrendingUp size={16} className="text-green-500" />
                                                Confidence
                                            </span>
                                            <span className="font-bold text-gray-800">{(prediction.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                            <div
                                                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all"
                                                style={{ width: `${prediction.confidence * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className={`p-4 rounded-lg ${prediction.predicted_water_need_mm > 30 ? 'bg-red-50 border border-red-200' :
                                        prediction.predicted_water_need_mm > 15 ? 'bg-yellow-50 border border-yellow-200' :
                                            'bg-green-50 border border-green-200'
                                        }`}>
                                        <p className="text-sm font-medium text-gray-700">{prediction.recommendation}</p>
                                    </div>

                                    <div className="text-xs text-gray-500 text-center pt-2 border-t">
                                        Model: {prediction.model_used} | {new Date(prediction.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-8 rounded-xl border-2 border-dashed border-gray-300 text-center h-full flex flex-col items-center justify-center">
                                <Droplet size={48} className="text-gray-400 mb-3" />
                                <p className="text-gray-500 font-medium">No prediction yet</p>
                                <p className="text-sm text-gray-400 mt-1">Fill the form and click predict</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TRAINING TAB */}
            {activeTab === 'train' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                            <Database size={20} className="text-green-600" />
                            <span>Upload Training Dataset</span>
                        </h3>
                        <p className="text-gray-500 mb-6 text-sm">
                            Upload a CSV file with all 37 variables. Minimum 100 rows recommended for quality training.
                        </p>

                        <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-green-500 transition-colors cursor-pointer group block">
                            <div className="p-4 bg-gray-50 rounded-full mb-3 group-hover:bg-green-50">
                                <Upload size={24} className="text-gray-400 group-hover:text-green-600" />
                            </div>
                            <p className="font-medium text-gray-700">{file ? file.name : 'Click to upload CSV'}</p>
                            <p className="text-xs text-gray-400 mt-1">Max file size: 50MB</p>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>

                        {loading && (
                            <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-700">Training in progress...</span>
                                    <span className="text-sm text-blue-600">Please wait</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                            <Activity size={20} className="text-purple-600" />
                            <span>Model Information</span>
                        </h3>

                        <div className="space-y-3">
                            {modelInfo.map((model, idx) => (
                                <div key={idx} className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-gray-800">{model.model_type} Model</h4>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${model.is_loaded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {model.is_loaded ? 'Loaded' : 'Not Trained'}
                                        </span>
                                    </div>
                                    {model.is_loaded && (
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-600">Accuracy:</span>
                                                <span className="font-semibold ml-2">{(model.accuracy * 100).toFixed(1)}%</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Version:</span>
                                                <span className="font-semibold ml-2">{model.version}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <h4 className="font-semibold text-amber-800 mb-2 text-sm">Required CSV Columns:</h4>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                fips, lat, lon, elevation, slope1-8, aspectN/E/S/W/Unknown,
                                WAT_LAND, NVG_LAND, URB_LAND, GRS_LAND, FOR_LAND, CULTRF_LAND,
                                CULTIR_LAND, CULT_LAND, SQ1-7
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SIMULATION TAB */}
            {activeTab === 'simulation' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Real-Time Sensor Simulation</h3>
                            <button
                                onClick={toggleSimulation}
                                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${simulationActive
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                {simulationActive ? (
                                    <><Activity size={16} className="animate-pulse" /> Stop Simulation</>
                                ) : (
                                    <><Play size={16} /> Start Simulation</>
                                )}
                            </button>
                        </div>

                        {simulationActive && (
                            <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-green-700 font-medium">Simulation Active - Generating data every 2 seconds</span>
                            </div>
                        )}

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {realtimeData.length > 0 ? (
                                realtimeData.map((reading, idx) => (
                                    <div key={idx} className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                            <div>
                                                <span className="text-gray-600">Sensor:</span>
                                                <span className="font-semibold ml-1">{reading.sensor_id}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Temp:</span>
                                                <span className="font-semibold ml-1">{reading.temperature?.toFixed(1)}°C</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Humidity:</span>
                                                <span className="font-semibold ml-1">{reading.humidity?.toFixed(1)}%</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Soil:</span>
                                                <span className="font-semibold ml-1">{reading.soil_moisture?.toFixed(1)}%</span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(reading.time).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Activity size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>No data yet. Start the simulation to see real-time readings.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    fetchLatestSensorData();
                                    setActiveTab('predict');
                                }}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-all"
                            >
                                Use Latest Data for Prediction
                            </button>

                            <button
                                onClick={fetchRecentReadings}
                                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-medium transition-all"
                            >
                                Refresh Data
                            </button>

                            <div className="pt-4 border-t">
                                <p className="text-sm text-gray-600 mb-2">Simulation generates:</p>
                                <ul className="text-xs text-gray-500 space-y-1">
                                    <li>• Temperature readings</li>
                                    <li>• Humidity levels</li>
                                    <li>• Soil moisture data</li>
                                    <li>• Light intensity</li>
                                    <li>• GPS coordinates</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
