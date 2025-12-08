import React, { useState } from 'react';
import { Play, Square, Activity, Wifi, Terminal } from 'lucide-react';

export default function SensorIngestion() {
    const [simulating, setSimulating] = useState(false);
    const [logs, setLogs] = useState([]);

    const toggleSimulation = () => {
        // Mock simulation toggle
        const newState = !simulating;
        setSimulating(newState);

        if (newState) {
            addLog("Simulation started. Generating synthetic data...");
            // Start streaming logs mock
            const interval = setInterval(() => {
                if (Math.random() > 0.5) {
                    addLog(`[Sensor-01] Temp: ${(20 + Math.random()).toFixed(1)}C, Moist: ${(30 + Math.random() * 5).toFixed(1)}%`);
                }
            }, 2000);
            // Store interval to clear (omitted for simple demo state)
        } else {
            addLog("Simulation stopped.");
        }
    };

    const addLog = (msg) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
    };

    return (
        <div className="space-y-6">
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

                    <p className="text-gray-500 mb-8">
                        Generate synthetic sensor data for Soil Moisture, Temperature, Humidity and Light intensity.
                        Data is pushed to Kafka and persisted in TimescaleDB.
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
                </div>
            </div>

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

// Helper icon
import { Database } from 'lucide-react';
