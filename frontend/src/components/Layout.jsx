import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, CloudRain, Droplets, Activity, Settings } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, path, active }) => (
    <Link
        to={path}
        className={`flex items-center space-x-3 px-6 py-4 transition-colors ${active
                ? 'bg-green-50 text-green-700 border-r-4 border-green-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
            }`}
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </Link>
);

export default function Layout() {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-lg flex flex-col z-10">
                <div className="p-6 border-b flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <span className="text-xl font-bold text-gray-800">AgroTrace</span>
                </div>

                <nav className="flex-1 overflow-y-auto py-6">
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Dashboard"
                        path="/"
                        active={location.pathname === '/'}
                    />
                    <SidebarItem
                        icon={CloudRain}
                        label="Prevision Eau"
                        path="/water-prediction"
                        active={location.pathname === '/water-prediction'}
                    />
                    <SidebarItem
                        icon={Droplets}
                        label="Irrigation Reco"
                        path="/irrigation-reco"
                        active={location.pathname === '/irrigation-reco'}
                    />
                    <SidebarItem
                        icon={Activity}
                        label="Sensor Simulation"
                        path="/sensors"
                        active={location.pathname === '/sensors'}
                    />
                </nav>

                <div className="p-4 border-t">
                    <div className="flex items-center space-x-3 text-gray-500 text-sm">
                        <Settings size={16} />
                        <span>v2.0.0</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8">
                    <h1 className="text-lg font-semibold text-gray-700">
                        {location.pathname === '/' ? 'Overview' :
                            location.pathname === '/water-prediction' ? 'Water Requirement Prediction' :
                                location.pathname === '/irrigation-reco' ? 'Irrigation Recognition' :
                                    'Sensor Ingestion Control'}
                    </h1>
                    <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold border border-green-200">
                            U
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
