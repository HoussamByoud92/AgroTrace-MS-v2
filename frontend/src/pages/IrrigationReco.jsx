import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Scan, AlertCircle, RefreshCw, Droplet, MapPin, ChevronDown, ChevronUp, Layers, Calendar, Clock, Zap, Activity, TrendingUp } from 'lucide-react';

export default function IrrigationReco() {
    const [analyses, setAnalyses] = useState([]);
    const [fields, setFields] = useState([]);
    const [expandedField, setExpandedField] = useState(null);
    const [selectedField, setSelectedField] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [imgLoading, setImgLoading] = useState(false);

    useEffect(() => {
        fetchAnalyses();
    }, []);

    const fetchAnalyses = async () => {
        setImgLoading(true);
        try {
            const response = await fetch('http://localhost:8004/api/v1/analyses');
            const data = await response.json();
            // Filter only those with fieldId
            const filteredData = Array.isArray(data) ? data.filter(item => item.fieldId !== null && item.fieldId !== undefined) : [];
            setAnalyses(filteredData);

            // Group by fieldId
            const fieldGroups = {};
            filteredData.forEach(item => {
                const fid = item.fieldId;
                if (!fieldGroups[fid]) {
                    fieldGroups[fid] = {
                        fieldId: fid,
                        fieldName: item.fieldName || `Field ${fid}`,
                        images: [],
                        totalStressed: 0,
                        avgConfidence: 0,
                        centerLat: 0,
                        centerLng: 0
                    };
                }
                fieldGroups[fid].images.push(item);
                fieldGroups[fid].totalStressed += item.count || 0;
            });

            // Calculate averages per field
            Object.values(fieldGroups).forEach(field => {
                const lats = field.images.map(i => i.lat);
                const lngs = field.images.map(i => i.lng);
                const confs = field.images.map(i => i.confidence);
                field.centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
                field.centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
                field.avgConfidence = confs.reduce((a, b) => a + b, 0) / confs.length;
            });

            const fieldList = Object.values(fieldGroups);
            setFields(fieldList);

            if (fieldList.length > 0 && !selectedField) {
                setSelectedField(fieldList[0]);
            }
        } catch (error) {
            console.error('Error fetching analyses:', error);
        }
        setImgLoading(false);
    };

    const handleToggleField = (fieldId) => {
        setExpandedField(expandedField === fieldId ? null : fieldId);
    };

    const handleSelectField = (field) => {
        setSelectedField(field);
        setRecommendation(null);
    };

    const handleGetRecommendation = async () => {
        if (!selectedField) return;
        setLoading(true);
        try {
            const ctx = {
                zone_id: selectedField.fieldId?.toString() || "1",
                lat: selectedField.centerLat,
                lon: selectedField.centerLng,
                crop_type: "Tomato",
                stressed_count: selectedField.totalStressed,
                avg_confidence: selectedField.avgConfidence
            };

            const response = await fetch('http://localhost:8006/recommendation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ctx)
            });
            const data = await response.json();
            setRecommendation(data);
        } catch (error) {
            console.error('Error fetching recommendation:', error);
            alert("Failed to fetch smart recommendation. Please try again.");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Irrigation Intelligence</h2>
                    <p className="text-emerald-100">Unified decisions combining computer vision, weather forecasting, and expert rules</p>
                </div>
                <button
                    onClick={fetchAnalyses}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all"
                    title="Refresh"
                >
                    <RefreshCw size={24} className={imgLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Field List */}
                <div className="lg:col-span-1 space-y-4 h-[calc(100vh-280px)] overflow-y-auto pr-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2 sticky top-0 bg-gray-50 py-2 z-10">
                        <Layers size={20} className="text-emerald-600" />
                        Agricultural Fields
                    </h3>

                    {imgLoading ? (
                        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed text-gray-400">
                            Loading fields...
                        </div>
                    ) : fields.length > 0 ? (
                        <div className="space-y-3">
                            {fields.map((field) => (
                                <div
                                    key={field.fieldId}
                                    className={`bg-white rounded-xl shadow-sm border-2 transition-all ${selectedField?.fieldId === field.fieldId
                                        ? 'border-emerald-500 ring-2 ring-emerald-100'
                                        : 'border-gray-100 hover:border-emerald-200'
                                        }`}
                                >
                                    {/* Field Header */}
                                    <div
                                        className="p-4 cursor-pointer"
                                        onClick={() => handleSelectField(field)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-gray-800 text-lg">{field.fieldName}</h4>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleField(field.fieldId); }}
                                                className="p-1 hover:bg-gray-100 rounded transition-all text-gray-400 hover:text-gray-600"
                                            >
                                                {expandedField === field.fieldId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <ImageIcon size={12} /> {field.images.length} Imagery
                                            </div>
                                            <div className="flex items-center gap-1 text-red-500 font-medium">
                                                <AlertCircle size={12} /> {field.totalStressed} Stressed
                                            </div>
                                            <div className="col-span-2 flex items-center gap-1 text-gray-500 mt-1">
                                                <MapPin size={12} className="text-emerald-500" />
                                                {field.centerLat.toFixed(4)}, {field.centerLng.toFixed(4)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedField === field.fieldId && (
                                        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50">
                                            <p className="text-[10px] text-gray-400 pt-3 pb-2 uppercase tracking-wider font-bold">Detection Gallery</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {field.images.slice(0, 6).map((img, idx) => (
                                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm h-16">
                                                        <img
                                                            src={img.previewUrl}
                                                            alt={img.imageName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] px-1 rounded-bl">
                                                            {img.count}
                                                        </div>
                                                    </div>
                                                ))}
                                                {field.images.length > 6 && (
                                                    <div className="bg-gray-100 rounded-lg flex items-center justify-center text-[10px] text-gray-500 font-bold border border-gray-200">
                                                        +{field.images.length - 6} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-300 text-gray-400">
                            <Layers size={48} className="opacity-20 mb-2" />
                            <p>No analyzed data found</p>
                        </div>
                    )}
                </div>

                {/* Main Action & Result */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedField ? (
                        <>
                            {/* Action Card */}
                            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 mb-1">Process Plan for {selectedField.fieldName}</h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-2">
                                            <Activity size={14} className="text-blue-500" />
                                            Aggregating Vision Detections & LSTM Water Forecast
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleGetRecommendation}
                                        disabled={loading}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <RefreshCw size={20} className="animate-spin" /> : <Zap size={20} />}
                                        Run Smart Diagnostic
                                    </button>
                                </div>
                            </div>

                            {/* Results Display */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Diagnostic Card */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <AlertCircle size={20} className="text-amber-500" />
                                        Field Health Diagnostic
                                    </h3>

                                    {recommendation ? (
                                        <div className="space-y-6 animate-in fade-in duration-500 flex-1 flex flex-col">
                                            <div className="p-4 bg-emerald-50 rounded-xl border-l-4 border-emerald-500">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Status Recommendation</p>
                                                <p className="text-xl font-black text-gray-800 leading-tight">{recommendation.recommendation}</p>
                                            </div>

                                            <div className="p-4 bg-amber-50 rounded-xl border-l-4 border-amber-500 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                                    <Droplet size={48} className="text-amber-900" />
                                                </div>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Rule-Based Action</p>
                                                <p className="text-sm text-amber-900 font-medium leading-relaxed">{recommendation.action}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-auto">
                                                <div className="p-3 bg-blue-50 rounded-lg text-center">
                                                    <p className="text-[10px] text-blue-600 font-bold uppercase">Immediate Need</p>
                                                    <p className="text-xl font-black text-blue-900">{recommendation.amount_mm?.toFixed(1)} <span className="text-xs font-normal">mm</span></p>
                                                </div>
                                                <div className="p-3 bg-cyan-50 rounded-lg text-center">
                                                    <p className="text-[10px] text-cyan-600 font-bold uppercase">Run Time</p>
                                                    <p className="text-xl font-black text-cyan-900">
                                                        {recommendation.hours}h {recommendation.minutes}m
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center py-12">
                                            <Activity size={64} className="opacity-10 mb-4" />
                                            <p className="font-medium text-gray-400">Awaiting intelligent analysis...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Forecast Card */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Calendar size={20} className="text-blue-500" />
                                        7-Day Requirement Forecast
                                    </h3>

                                    {recommendation && recommendation.forecast_days ? (
                                        <div className="space-y-3 overflow-y-auto max-h-80 pr-1 animate-in slide-in-from-right duration-500">
                                            {recommendation.forecast_days.map((day, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-blue-50/30 transition-colors group">
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-400 group-hover:text-blue-400 transition-colors uppercase">Day {day.day} • {day.date}</div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="text-sm font-bold text-gray-700">{day.temperature}°C</div>
                                                            <div className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-500 border border-gray-200 italic">{day.recommendation}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-blue-600 flex items-center justify-end gap-1">
                                                            <Droplet size={12} />
                                                            {day.water_need_mm?.toFixed(1)} mm
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                                                            <Clock size={10} />
                                                            {day.irrigation_hours}h {day.irrigation_minutes}m
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center py-12">
                                            <TrendingUp size={64} className="opacity-10 mb-4" />
                                            <p className="font-medium text-gray-400">Select field to run LSTM model</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-4 border-dashed border-gray-200 p-12 text-center text-gray-400">
                            <Layers size={80} className="opacity-5 mb-6" />
                            <h3 className="text-2xl font-bold text-gray-500 mb-2">No Field Selected</h3>
                            <p className="max-w-md">Please select a field from the side list to begin the unified smart irrigation diagnostic process.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
