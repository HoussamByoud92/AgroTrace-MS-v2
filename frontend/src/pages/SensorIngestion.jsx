import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, Wifi, Terminal, Download, Database } from 'lucide-react';

export default function SensorIngestion() {
    const [simulating, setSimulating] = useState(false);
    const [logs, setLogs] = useState([]);
    const [fullData, setFullData] = useState([]);
    const [exportRows, setExportRows] = useState(50);
    const [stats, setStats] = useState({ total: 0, lastUpdate: null });

    // Check simulation status on mount
    useEffect(() => {
        checkSimulationStatus();
    }, []);

    // Poll for data when simulation is active
    useEffect(() => {
        let interval;
        if (simulating) {
            interval = setInterval(() => {
                fetchFullData();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [simulating]);

    const checkSimulationStatus = async () => {
        try {
            const response = await fetch('http://localhost:8002/simulate/status');
            const data = await response.json();
            setSimulating(data.is_active);
        } catch (error) {
            console.error('Error checking simulation status:', error);
        }
    };

    const fetchFullData = async () => {
        try {
            const response = await fetch('http://localhost:8002/simulate/generate-full?count=5');
            const data = await response.json();

            if (data && data.length > 0) {
                setFullData(prev => [...data, ...prev].slice(0, 20));
                setStats({
                    total: stats.total + data.length,
                    lastUpdate: new Date().toLocaleTimeString()
                });

                // Add log entry
                addLog(`Generated ${data.length} records with 37 variables`);
            }
        } catch (error) {
            console.error('Error fetching full data:', error);
            addLog(`Error: ${error.message}`);
        }
    };

    const toggleSimulation = async () => {
        try {
            const endpoint = simulating ? '/simulate/stop' : '/simulate/start';
            await fetch(`http://localhost:8002${endpoint}`, { method: 'POST' });

            const newState = !simulating;
            setSimulating(newState);

            if (newState) {
                addLog("Simulation started - generating 37-variable dataset");
                setStats({ total: 0, lastUpdate: null });
                fetchFullData(); // Fetch immediately
            } else {
                addLog("Simulation stopped");
            }
        } catch (error) {
            console.error('Simulation toggle error:', error);
            addLog(`Error: ${error.message}`);
        }
    };

    const handleExportCSV = async () => {
        if (exportRows < 20) {
            alert('Minimum 20 rows required for export');
            return;
        }

        try {
            addLog(`Exporting ${exportRows} rows to CSV...`);
            const response = await fetch(`http://localhost:8002/simulate/export-csv?rows=${exportRows}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sensor_simulation_${exportRows}_rows.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addLog(`Successfully exported ${exportRows} rows`);
        } catch (error) {
            console.error('Export error:', error);
            addLog(`Export failed: ${error.message}`);
            alert(`Export failed: ${error.message}`);
        }
    };

    const addLog = (msg) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 15));
    };

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Sensor Data Simulation</h2>
                <p className="text-purple-100 mb-4">Generate synthetic data with all 37 variables for water prediction model</p>
                <div className="flex gap-4">
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                        <div className="text-xs text-purple-100">Records Generated</div>
                        <div className="font-semibold text-lg">{stats.total}</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                        <div className="text-xs text-purple-100">Last Update</div>
                        <div className="font-semibold text-lg">{stats.lastUpdate || 'N/A'}</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                        <div className="text-xs text-purple-100">Variables per Record</div>
                        <div className="font-semibold text-lg">37</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Control Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-800">Simulation Control</h3>
                        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${simulating ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${simulating ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                            <span>{simulating ? 'RUNNING' : 'STOPPED'}</span>
                        </div>
                    </div>

                    <p className="text-gray-500 mb-6 text-sm">
                        Generate synthetic sensor data with all 37 variables including location, slopes, aspects, land cover, and soil quality indices.
                    </p>

                    <button
                        onClick={toggleSimulation}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform active:scale-95 ${simulating
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg'
                            }`}
                    >
                        {simulating ? <><Square /> <span>Stop Simulation</span></> : <><Play /> <span>Start Simulation</span></>}
                    </button>

                </div>

                {/* Status Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Infrastructure Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <Wifi size={20} className="text-blue-500" />
                                <span className="font-medium text-gray-700">Kafka Broker</span>
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">ONLINE</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <Database size={20} className="text-purple-500" />
                                <span className="font-medium text-gray-700">TimescaleDB</span>
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">ONLINE</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <Activity size={20} className="text-orange-500" />
                                <span className="font-medium text-gray-700">Ingestion Service</span>
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">ONLINE</span>
                        </div>
                    </div>

                    {/* Variable List */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-3">Generated Variables (37)</h4>
                        <div className="text-xs text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                            <div className="font-medium text-blue-600">Location (4):</div>
                            <div className="pl-3">fips, lat, lon, elevation</div>

                            <div className="font-medium text-purple-600 mt-2">Slopes (8):</div>
                            <div className="pl-3">slope1-8</div>

                            <div className="font-medium text-orange-600 mt-2">Aspects (5):</div>
                            <div className="pl-3">aspectN, aspectE, aspectS, aspectW, aspectUnknown</div>

                            <div className="font-medium text-green-600 mt-2">Land Cover (8):</div>
                            <div className="pl-3">WAT_LAND, NVG_LAND, URB_LAND, GRS_LAND, FOR_LAND, CULTRF_LAND, CULTIR_LAND, CULT_LAND</div>

                            <div className="font-medium text-amber-600 mt-2">Soil Quality (7):</div>
                            <div className="pl-3">SQ1-7</div>

                            <div className="font-medium text-red-600 mt-2">Environmental (5):</div>
                            <div className="pl-3">temperature, humidity, soil_moisture, sensor_id, timestamp</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Data Display */}
            {fullData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Generated Data</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {fullData.map((record, idx) => (
                            <div key={idx} className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Sensor:</span>
                                        <span className="font-semibold ml-1">{record.sensor_id}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Lat/Lon:</span>
                                        <span className="font-semibold ml-1">{record.lat?.toFixed(2)}, {record.lon?.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Elevation:</span>
                                        <span className="font-semibold ml-1">{record.elevation?.toFixed(1)}m</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Temp:</span>
                                        <span className="font-semibold ml-1">{record.temperature?.toFixed(1)}°C</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Humidity:</span>
                                        <span className="font-semibold ml-1">{record.humidity?.toFixed(1)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Soil:</span>
                                        <span className="font-semibold ml-1">{record.soil_moisture?.toFixed(1)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">SQ1:</span>
                                        <span className="font-semibold ml-1">{record.SQ1?.toFixed(1)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {record.timestamp}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Logs */}
            <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden text-gray-300 font-mono text-sm">
                <div className="bg-gray-800 px-4 py-3 flex items-center space-x-2 border-b border-gray-700">
                    <Terminal size={16} />
                    <span>Live Stream Logs</span>
                </div>
                <div className="p-4 h-48 overflow-y-auto space-y-2">
                    {logs.length === 0 && <span className="text-gray-600 text-center block mt-10 opacity-50">Waiting for data stream...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="border-l-2 border-green-500 pl-3">
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
