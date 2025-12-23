import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Thermometer, Droplets, Sun, AlertTriangle, Wind } from 'lucide-react';
import axios from 'axios';

const StatCard = ({ icon: Icon, label, value, unit, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium">{label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{value} <span className="text-sm font-normal text-gray-400">{unit}</span></p>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    </div>
);

export default function Dashboard() {
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch forecast data and manage 2-hour sliding window
    useEffect(() => {
        const fetchForecast = async () => {
            try {
                // Fetch 12 future intervals (24 hours) from the proxy endpoint
                const response = await axios.get('/api/ingest/forecast/15min');
                if (response.data && Array.isArray(response.data)) {
                    const formattedData = response.data.map(r => ({
                        ...r,
                        // Clean 12-hour time for X-axis (e.g. 12:00 AM)
                        time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                    }));
                    setReadings(formattedData);
                }
                setLoading(false);
            } catch (e) {
                console.error("Forecast API Fetch Error:", e);
            }
        };

        fetchForecast();
        // Refresh every 2 hours (2 * 60 * 60 * 1000 = 7,200,000 ms)
        const interval = setInterval(fetchForecast, 7200000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading Dashboard...</div>;

    const current = readings[0] || {}; // Use first point as current forecast

    return (
        <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={Thermometer} label="Forecast Temperature" value={current.temperature?.toFixed(1)} unit="°C" color="bg-orange-500" />
                <StatCard icon={Droplets} label="Soil Moisture (1-3cm)" value={current.soil_moisture?.toFixed(2)} unit="m³/m³" color="bg-blue-500" />
                <StatCard icon={Sun} label="Relative Humidity" value={current.humidity?.toFixed(0)} unit="%" color="bg-teal-500" />
                <StatCard icon={Wind} label="Wind Speed" value={current.wind_speed?.toFixed(1)} unit="km/h" color="bg-indigo-500" />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Temperature</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={readings}>
                                <defs>
                                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip />
                                <Area type="monotone" dataKey="temperature" stroke="#f97316" fillOpacity={1} fill="url(#colorTemp)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Humidity</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={readings}>
                                <defs>
                                    <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip />
                                <Area type="monotone" dataKey="humidity" stroke="#14b8a6" fillOpacity={1} fill="url(#colorHum)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Soil Moisture</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={readings}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip />
                                <Line type="monotone" dataKey="soil_moisture" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Wind Speed</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={readings}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip />
                                <Line type="monotone" dataKey="wind_speed" stroke="#6366f1" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Alerts List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Recent Recommendations</h3>
                </div>
                <div className="divide-y">
                    {[1, 2, 3].map((_, i) => (
                        <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                            <div>
                                <p className="font-medium text-gray-800">Zone A-{i + 1}: Irrigation Required</p>
                                <p className="text-sm text-gray-500">Soil moisture dropped below 30%</p>
                            </div>
                            <span className="text-xs font-semibold px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                                Pending
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
