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
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch forecast data and recommendations
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch 15min forecast
                const forecastRes = await axios.get('/api/ingest/forecast/15min');
                if (forecastRes.data && Array.isArray(forecastRes.data)) {
                    const formattedData = forecastRes.data.map(r => ({
                        ...r,
                        time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                    }));
                    setReadings(formattedData);
                }

                // Fetch recent recommendations
                const recoRes = await axios.get('/api/reco/history?limit=5');
                if (recoRes.data && Array.isArray(recoRes.data)) {
                    setRecommendations(recoRes.data);
                }

                setLoading(false);
            } catch (e) {
                console.error("Dashboard Data Fetch Error:", e);
                setLoading(false);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000); // 30 sec refresh for recommendations
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading Dashboard...</div>;

    const current = readings[0] || {};

    return (
        <div className="space-y-6 text-gray-800">
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
                    <h3 className="text-lg font-semibold mb-4">Temperature Forecast</h3>
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
                    <h3 className="text-lg font-semibold mb-4">Humidity Forecast</h3>
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
                    <h3 className="text-lg font-semibold mb-4">Soil Moisture Forecast</h3>
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
                    <h3 className="text-lg font-semibold mb-4">Wind Speed Forecast</h3>
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

            {/* Recent Recommendations List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Recent AI Recommendations</h3>
                    <span className="text-xs text-gray-400">Live Updates</span>
                </div>
                <div className="divide-y overflow-y-auto max-h-96">
                    {recommendations.length > 0 ? recommendations.map((reco, i) => (
                        <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-2 h-2 rounded-full ${reco.recommendation?.toLowerCase().includes('urgent') ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                <div>
                                    <p className="font-bold text-gray-800">
                                        Field {reco.zone_id}: {reco.recommendation}
                                    </p>
                                    <p className="text-sm text-gray-500 italic">
                                        {reco.details?.split('Factors:')[1] || reco.details}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                            {reco.water_amount_mm?.toFixed(1)} mm
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(reco.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="px-6 py-8 text-center text-gray-400">
                            No recommendations logged yet. Run a diagnostic in Irrigation Reco!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
