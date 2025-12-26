import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, CloudRain, Droplets, Activity, Settings, Database } from 'lucide-react';

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

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-lg flex flex-col z-10">
                <div className="p-6 border-b flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xl">☘︎</span>
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
                        icon={Map}
                        label="Vision Map"
                        path="/vision-map"
                        active={location.pathname === '/vision-map'}
                    />
                    <SidebarItem
                        icon={Droplets}
                        label="Irrigation Reco"
                        path="/irrigation-reco"
                        active={location.pathname === '/irrigation-reco'}
                    />
                    {/* <SidebarItem
                        icon={Activity}
                        label="Sensor Simulation"
                        path="/sensors"
                        active={location.pathname === '/sensors'}
                    /> */}
                    <SidebarItem
                        icon={Database}
                        label="Databases"
                        path="/databases"
                        active={location.pathname === '/databases'}
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
                            location.pathname === '/vision-map' ? 'Crop Stress Detection' :
                                location.pathname === '/irrigation-reco' ? 'Irrigation Recognition' :
                                    location.pathname === '/sensors' ? 'Sensor Ingestion Control' :
                                        location.pathname === '/databases' ? 'Databases' : 'Overview'}
                    </h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-700 mr-2">{user.username}</span>
                        <div
                            className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold border border-green-200 cursor-pointer hover:bg-green-200 transition-colors"
                            title="Click to logout"
                            onClick={handleLogout}
                        >
                            {initial}
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
