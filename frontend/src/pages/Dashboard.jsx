import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Thermometer, Droplets, Sun, AlertTriangle } from 'lucide-react';
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

    // Poll for data (Simulation of real-time update)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Try simple mock first if backend not reachable (common in dev env without full docker)
                // In real docker env: await axios.get('/api/ingestion/recent')
                const mockData = Array.from({ length: 20 }, (_, i) => ({
                    time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temperature: 20 + Math.random() * 5,
                    humidity: 50 + Math.random() * 10,
                    soil_moisture: 30 + Math.random() * 15
                }));
                setReadings(mockData);
                setLoading(false);
            } catch (e) {
                console.error(e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div>Loading Dashboard...</div>;

    const current = readings[readings.length - 1] || {};

    return (
        <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={Thermometer} label="Avg Temperature" value={current.temperature?.toFixed(1)} unit="°C" color="bg-orange-500" />
                <StatCard icon={Droplets} label="Soil Moisture" value={current.soil_moisture?.toFixed(1)} unit="%" color="bg-blue-500" />
                <StatCard icon={Sun} label="Humidity" value={current.humidity?.toFixed(1)} unit="%" color="bg-teal-500" />
                <StatCard icon={AlertTriangle} label="Active Alerts" value="2" unit="" color="bg-red-500" />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Live Temperature</h3>
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
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip />
                                <Area type="monotone" dataKey="temperature" stroke="#f97316" fillOpacity={1} fill="url(#colorTemp)" />
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
                                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="soil_moisture" stroke="#3b82f6" strokeWidth={3} dot={false} />
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
