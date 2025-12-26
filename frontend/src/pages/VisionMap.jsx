import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap, LayersControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './visionmap.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Sample images for demo
const SAMPLE_IMAGES = [
    "image100_jpg.rf.8667387314337a14bc44f924320881be.jpg",
    "image101_jpg.rf.06c5be9078399fb41939722a7f1cd483.jpg",
    "image102_jpg.rf.db10e7d210eaf19a9b303be7b4eddfe8.jpg",
    "image105_jpg.rf.0a63f2a7e2d7d8f9a3146ab47b4d2255.jpg",
    "image106_jpg.rf.c4d97e685514e0607e19665d0a93bca7.jpg",
    "image107_jpg.rf.6420000dac7d10b24c1bb901d7b8beee.jpg",
    "image109_jpg.rf.7bc55d525d3e6dab53240f4e2185f893.jpg",
    "image10_jpg.rf.57ce447fb459fd905c39f07da337c783.jpg",
    "image112_jpg.rf.73b1624a9df7e0f82727a9cea1df1706.jpg",
    "image113_jpg.rf.cb0aab4397b6531d0eadf995dff88331.jpg",
    "image114_jpg.rf.3fe1efee616cbb72533b189ac5e7a036.jpg",
    "image116_jpg.rf.4d50e0b1d175e18802b66f62b21947ed.jpg",
    "image117_jpg.rf.72610137f0bd3f80a1067c8e9ddba2ae.jpg",
    "image118_jpg.rf.827e383f97f769c4902079eaa83bbc97.jpg",
    "image119_jpg.rf.7338e15f6884c47c9bd5ba243cf1f3a5.jpg",
    "image120_jpg.rf.6f94e7c3f1acb1d4500cb82955ad78ad.jpg",
    "image121_jpg.rf.41862258038cbe78b8154b6356b7fbc5.jpg",
    "image122_jpg.rf.65ede65fcfbed6edded7eb3051314f2c.jpg",
    "image124_jpg.rf.725d76ccb8b39e25b3b55dd03c045815.jpg",
    "image125_jpg.rf.ee02809274c77d171098caf6ba82ab91.jpg",
    "image126_jpg.rf.e433806a22d7bb3868db4b5c480a07b9.jpg",
    "image127_jpg.rf.4a80adda7196a260c48bacbf8a4bc44b.jpg",
    "image128_jpg.rf.b137dbc174c63132072b24b1d142c5a1.jpg",
    "image131_jpg.rf.de4f5c6e2da10de20fbaaa95b5f8de17.jpg",
    "image132_jpg.rf.c0aad93d165c80cb38de5492a325805d.jpg",
    "image134_jpg.rf.fbd68ec44ac77d17f32b03e6bb346cc7.jpg",
    "image135_jpg.rf.76630da0325bf70f6e87f5ddd6abc625.jpg",
    "image136_jpg.rf.b972133e1aecd0db126c4a00652ed137.jpg",
    "image139_jpg.rf.9156366bf2f622aa17b1d662dd36e8bd.jpg",
    "image13_jpg.rf.3cb02f3d63da47f650a65b3262891b8a.jpg"
];

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Geometry utilities
const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    const { lat, lng } = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const getPolygonBounds = (polygon) => {
    if (!polygon || polygon.length === 0) return null;
    let minLat = polygon[0].lat, maxLat = polygon[0].lat;
    let minLng = polygon[0].lng, maxLng = polygon[0].lng;
    for (const point of polygon) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
    }
    return { minLat, maxLat, minLng, maxLng };
};

const generateRandomCoordinateInPolygon = (polygon, maxRetries = 100) => {
    if (!polygon || polygon.length < 3) return null;
    const bounds = getPolygonBounds(polygon);
    if (!bounds) return null;
    for (let i = 0; i < maxRetries; i++) {
        const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
        const lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
        if (isPointInPolygon({ lat, lng }, polygon)) return { lat, lng };
    }
    // Fallback to center
    let sumLat = 0, sumLng = 0;
    for (const point of polygon) { sumLat += point.lat; sumLng += point.lng; }
    return { lat: sumLat / polygon.length, lng: sumLng / polygon.length };
};

// Map Drawing Component
function DrawControls({ onPolygonCreated, onPolygonDeleted, featureGroupRef, drawControlRef }) {
    const handleCreated = (e) => {
        const layer = e.layer;
        if (e.layerType === 'polygon') {
            const latlngs = layer.getLatLngs()[0];
            const polygon = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
            onPolygonCreated(polygon, layer);
        }
    };

    const handleDeleted = (e) => {
        onPolygonDeleted(e);
    };

    return (
        <FeatureGroup ref={featureGroupRef}>
            <EditControl
                ref={drawControlRef}
                position="topright"
                onCreated={handleCreated}
                onDeleted={handleDeleted}
                draw={{
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false,
                    polygon: {
                        allowIntersection: true,
                        showArea: true,
                        drawError: {
                            color: '#e1e100',
                            message: '<strong>Error:</strong> shape edges cannot cross!'
                        },
                        shapeOptions: {
                            color: '#28a745',
                            fillColor: '#28a745',
                            fillOpacity: 0.2,
                            weight: 3
                        }
                    }
                }}
                edit={{
                    remove: true,
                    edit: false
                }}
            />
        </FeatureGroup>
    );
}

// Markers component
function ResultMarkers({ markers }) {
    const map = useMap();

    useEffect(() => {
        const leafletMarkers = [];
        markers.forEach(m => {
            const color = m.confidence >= 0.60 ? '#dc3545' : '#ff9800';
            const marker = L.circleMarker([m.lat, m.lng], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
            marker.bindPopup(`
                <div style="padding: 10px; min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0;">Average Stress - ${(m.confidence * 100).toFixed(0)}%</h4>
                    <div style="margin-bottom: 8px;">
                        <img src="${m.previewUrl}" alt="${m.imageName}" style="width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd;" />
                    </div>
                    <p style="margin: 4px 0; font-size: 0.9em;"><strong>Image:</strong> ${m.imageName}</p>
                    <p style="margin: 4px 0;"><strong>Status:</strong> ${m.className} (${m.count} zones)</p>
                    <p style="margin: 4px 0;"><strong>Coords:</strong> ${m.lat.toFixed(6)}, ${m.lng.toFixed(6)}</p>
                </div>
            `);
            marker.addTo(map);
            leafletMarkers.push(marker);
        });

        return () => {
            leafletMarkers.forEach(m => map.removeLayer(m));
        };
    }, [markers, map]);

    return null;
}

// Helper to render saved polygons into the FeatureGroup so they are editable
function SavedFieldsLayer({ polygons, featureGroupRef }) {
    const map = useMap();
    const renderedRef = useRef(new Set());

    useEffect(() => {
        if (!featureGroupRef.current) return;

        const group = featureGroupRef.current;

        polygons.forEach(poly => {
            // Only add if not already rendered (using ID)
            // But we also need to handle updates/removals if polygons list changes (e.g. deletion)
            // For now, simpler approach: clear and re-add if list changes substantially?
            // Or just check if ID exists in group.

            if (!poly.saved) return; // Ignore unsaved ones managed by DrawControl interaction
            if (!poly.id) return;

            // Check if layer with this ID exists in the group
            let cached = false;
            group.eachLayer(layer => {
                if (layer.feature?.properties?.id === poly.id) cached = true;
            });

            if (!cached) {
                // Create Leaflet polygon
                const leafletPoly = L.polygon(poly.coordinates, {
                    color: '#28a745',
                    fillColor: '#28a745',
                    fillOpacity: 0.2,
                    weight: 3
                });

                // Add ID to feature properties for identification during delete
                leafletPoly.feature = leafletPoly.feature || {};
                leafletPoly.feature.properties = { id: poly.id };

                leafletPoly.addTo(group);
            }
        });

        // Cleanup removed polygons (if deleted from other tab or list update)
        group.eachLayer(layer => {
            const id = layer.feature?.properties?.id;
            if (id && !polygons.find(p => p.id === id)) {
                group.removeLayer(layer);
            }
        });

    }, [polygons, featureGroupRef]);

    return null;
}

export default function VisionMap() {
    const [polygons, setPolygons] = useState([]); // Array of polygons
    const [polygonLayers, setPolygonLayers] = useState([]); // Array of layers
    const [images, setImages] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [status, setStatus] = useState({ polygon: '', processing: '', results: '' });
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [fieldSize, setFieldSize] = useState(50);
    const [spreadMarkers, setSpreadMarkers] = useState(true);
    const featureGroupRef = useRef(null);
    const drawControlRef = useRef(null);
    const mapRef = useRef(null);

    const visionPlantUrl = 'http://localhost:8004';

    // Load saved analyses (markers) on mount
    useEffect(() => {
        const fetchAnalyses = async () => {
            try {
                const response = await fetch(`${visionPlantUrl}/api/v1/analyses`);
                if (!response.ok) throw new Error('Failed to fetch analyses');
                const data = await response.json();

                // Set markers
                setMarkers(data);

                if (data.length > 0) {
                    setStatus(s => ({ ...s, results: `Loaded ${data.length} saved detections` }));
                }
            } catch (err) {
                console.error("Error loading analyses:", err);
            }
        };
        fetchAnalyses();
    }, []);

    // Load fields on mount
    useEffect(() => {
        const fetchFields = async () => {
            try {
                // Get user ID (mock for now if not in local storage, matching backend default)
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const userId = user.id || 1; // Default to 1 instead of 2

                const response = await fetch(`${visionPlantUrl}/api/v1/fields?user_id=${userId}`);
                if (!response.ok) throw new Error('Failed to fetch fields');

                const data = await response.json();

                // Add fields to state (layer will be null initially, drawn when rendered?)
                // Actually, we need to draw them on the map. 
                // Since we use FeatureGroup with EditControl, we might need to rely on 
                // standard React-Leaflet Polygon or GeoJSON components for saved items, 
                // OR add them to the FeatureGroup manually. 
                // For simplicity with EditControl, we can't easily "inject" them into the draw layer 
                // without using L.polygon().addTo(featureGroup).

                // We'll store them in state and render persistent Polygons outside EditControl 
                // or just let the user draw new ones. 
                // BUT user wants to see them.

                // Let's assume we render them as <Polygon> components if they are saved.
                // But EditControl manages its own internal state.

                setPolygons(data.map(f => ({
                    ...f,
                    coordinates: f.coordinates,
                    saved: true
                })));

                setStatus(s => ({ ...s, polygon: `Loaded ${data.length} saved fields` }));
            } catch (err) {
                console.error("Error loading fields:", err);
            }
        };

        fetchFields();
    }, []);

    const handlePolygonCreated = async (poly, layer) => {
        try {
            // Get user ID from localStorage
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user.id;

            if (!userId) {
                console.warn("User not logged in, using default ID");
            }

            // Save field to backend
            const response = await fetch(`${visionPlantUrl}/api/v1/fields`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `Field ${polygons.length + 1}`,
                    coordinates: poly,
                    user_id: userId || 2 // Default to 2 to match backend default
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save field');
            }

            const savedField = await response.json();

            // Store field with ID
            // Add custom property to layer to track ID for deletion
            layer.feature = layer.feature || {};
            layer.feature.properties = { id: savedField.id };

            setPolygons(prev => [...prev, { ...savedField, coordinates: poly, layer, saved: true }]);
            setPolygonLayers(prev => [...prev, layer]);

            setStatus(s => ({ ...s, polygon: `Field boundary saved (ID: ${savedField.id})` }));
        } catch (error) {
            console.error("Error saving field:", error);
            setStatus(s => ({ ...s, polygon: `Error saving field: ${error.message}` }));
            // Add locally anyway
            setPolygons(prev => [...prev, { coordinates: poly, layer, id: null, saved: false }]);
            setPolygonLayers(prev => [...prev, layer]);
        }
    };

    // Handle deletion via Leaflet Draw toolbar
    const handlePolygonDeleted = async (e) => {
        const layers = e.layers;
        let deletedCount = 0;

        // Convert layers to array to handle async properly
        const layersArray = [];
        layers.eachLayer(layer => layersArray.push(layer));

        for (const layer of layersArray) {
            // Find field ID from layer properties or matching logic
            // Since we reload fields on mount, the layer objects in DrawControl might be different 
            // than what we have in state if we didn't add them to FeatureGroup manually.
            // But IF we user starts deleting, they deleting what's on map.

            // If the layer was just drawn, it has the ID we attached.
            // If it was loaded from DB, we need to map it back.
            // BUT wait, saved fields need to be added to the map so they CAN be deleted.

            const fieldId = layer.feature?.properties?.id;

            if (fieldId) {
                try {
                    await fetch(`${visionPlantUrl}/api/v1/fields/${fieldId}`, {
                        method: 'DELETE'
                    });
                    deletedCount++;
                } catch (err) {
                    console.error("Error deleting field:", err);
                }
            }
        }

        // Update local state
        // We filter out polygons that match the deleted layers or IDs
        // Simplest is to just re-fetch or filter if we have IDs

        // Refetching is safer to ensure sync
        const response = await fetch(`${visionPlantUrl}/api/v1/fields`);
        if (response.ok) {
            const data = await response.json();
            setPolygons(data.map(f => ({ ...f, coordinates: f.coordinates, saved: true })));
        } else {
            // Fallback local clear
            setPolygons(prev => prev.filter(p => !layersArray.some(l => l.feature?.properties?.id === p.id)));
        }

        setStatus(s => ({ ...s, polygon: `Deleted ${deletedCount} fields` }));
    };

    const startDrawing = () => {
        if (featureGroupRef.current) {
            // Clear existing polygons
            featureGroupRef.current.clearLayers();
            setPolygons([]);
            setPolygonLayers([]);
        }
        // Trigger the polygon draw tool
        if (drawControlRef.current) {
            const drawControl = drawControlRef.current;
            if (drawControl._toolbars && drawControl._toolbars.draw) {
                drawControl._toolbars.draw._modes.polygon.handler.enable();
            }
        }
        setStatus(s => ({ ...s, polygon: 'Click on map to draw field boundaries. You can draw multiple.' }));
    };

    const clearPolygon = () => {
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        setPolygons([]);
        setPolygonLayers([]);
        setImages([]);
        setStatus(s => ({ ...s, polygon: 'Field boundaries cleared' }));
    };

    const generateRandomDataset = useCallback(async () => {
        if (polygons.length === 0) {
            setStatus(s => ({ ...s, processing: 'Please draw at least one field boundary first!' }));
            return;
        }

        setStatus(s => ({ ...s, processing: 'Generating random dataset from ' + SAMPLE_IMAGES.length + ' sample images...' }));

        const newImages = [];

        try {
            // Load actual image blobs from public folder
            for (let i = 0; i < SAMPLE_IMAGES.length; i++) {
                const filename = SAMPLE_IMAGES[i];
                const response = await fetch(`/sample_images/${filename}`);
                if (!response.ok) {
                    console.warn(`Failed to load sample image: ${filename}`);
                    continue;
                }
                const blob = await response.blob();

                // Distribute images equally among polygons
                const targetField = polygons[i % polygons.length];
                const targetPolygon = targetField.coordinates;

                newImages.push({
                    id: generateUUID(),
                    name: filename,
                    coordinates: generateRandomCoordinateInPolygon(targetPolygon),
                    preview: URL.createObjectURL(blob),
                    blob: blob,
                    processed: false,
                    fieldId: targetField.id
                });
            }

            setImages(newImages);
            setStatus(s => ({ ...s, processing: `Loaded ${newImages.length} images distributed across ${polygons.length} zones` }));
        } catch (error) {
            console.error('Error generating dataset:', error);
            setStatus(s => ({ ...s, processing: 'Error loading sample images. Make sure they exist in public/sample_images.' }));
        }
    }, [polygons]);

    const processImages = async () => {
        if (images.length === 0) {
            setStatus(s => ({ ...s, processing: 'No images to process! Generate dataset first.' }));
            return;
        }

        setProcessing(true);
        setProgress(0);
        setMarkers([]);
        setStatus(s => ({ ...s, processing: `Processing ${images.length} images...` }));

        const newMarkers = [];
        let processedCount = 0;
        let totalDetections = 0;

        for (const img of images) {
            try {
                // Determine API URL - use port 8003 for vision-plante
                const apiUrl = `${visionPlantUrl}/api/v1/detect`;

                // Create FormData with the actual image blob
                const formData = new FormData();
                if (img.blob) {
                    formData.append('image', img.blob, img.name);
                    if (img.fieldId) {
                        formData.append('field_id', img.fieldId);
                    }
                    if (img.coordinates) {
                        formData.append('lat', String(img.coordinates.lat));
                        formData.append('lng', String(img.coordinates.lng));
                    }
                } else {
                    // Fallback if no blob (should not happen with new loader)
                    console.warn('No blob for image:', img.name);
                    continue;
                }

                // Send to backend
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const result = await response.json();

                // Process real results from backend - AGGREGATE PER IMAGE
                if (result.detections && result.detections.length > 0) {
                    // Filter for stressed crops only (class_name is usually "stressed")
                    const stressedDetections = result.detections.filter(
                        d => d.class_name === 'stressed' || d.class_name === 'st'
                    );

                    // Only show marker if image contains stressed crops
                    if (stressedDetections.length > 0) {
                        // Calculate average stress (confidence)
                        const totalConfidence = stressedDetections.reduce((sum, d) => sum + d.confidence, 0);
                        const avgConfidence = totalConfidence / stressedDetections.length;

                        totalDetections += stressedDetections.length;

                        newMarkers.push({
                            // Use the image location - one marker per image
                            lat: img.coordinates.lat,
                            lng: img.coordinates.lng,
                            confidence: avgConfidence, // Use AVERAGE stress confidence
                            className: 'stressed', // Overall status
                            imageName: img.name,
                            previewUrl: result.image_url,
                            count: stressedDetections.length // Keep track of count
                        });
                    }
                    // If no stressed detections, no marker is added (as requested)
                }

                processedCount++;
                setProgress((processedCount / images.length) * 100);
            } catch (error) {
                console.error(`Error processing ${img.name}:`, error);
            }
        }

        setMarkers(newMarkers);
        setProcessing(false);
        setStatus(s => ({
            ...s,
            processing: `✓ Processed ${processedCount} images. Found ${totalDetections} stressed detections.`,
            results: `Images: ${processedCount} | Detections: ${totalDetections} | Markers: ${newMarkers.length}`
        }));
    };

    const clearResults = () => {
        setMarkers([]);
        setImages([]);
        setProgress(0);
        setStatus({ polygon: status.polygon, processing: '', results: '' });
    };

    return (
        <div className="vision-map-container">
            {/* Sidebar Controls */}
            <div className="vision-sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <i className="fa-solid fa-leaf"></i>
                    </div>
                    <div className="title-container">
                        <h1>VisionPlant</h1>
                        <p>Crop Stress Detection</p>
                    </div>
                </div>

                <div className="sidebar-content">


                    {/* Step 2: Generate Dataset */}
                    <div className="step-card">
                        <div className="step-header">
                            <span className="step-number">1</span>
                            <h2>Upload Imagery</h2>
                        </div>
                        <div className="step-body">
                            <button
                                className="btn btn-primary full-width"
                                onClick={generateRandomDataset}
                                disabled={polygons.length === 0}
                            >
                                Generate Random Dataset
                            </button>
                            {images.length > 0 && (
                                <div className="image-count">{images.length} images loaded with coordinates</div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Processing Options */}
                    <div className="step-card">
                        <div className="step-header">
                            <span className="step-number">2</span>
                            <h2>Processing</h2>
                        </div>
                        <div className="step-body">
                            <div className="checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    id="spreadMarkers"
                                    checked={spreadMarkers}
                                    onChange={(e) => setSpreadMarkers(e.target.checked)}
                                />
                                <label htmlFor="spreadMarkers">Use bounding box positions</label>
                            </div>
                            <div className="input-group">
                                <label>Field Area (meters)</label>
                                <input
                                    type="number"
                                    value={fieldSize}
                                    onChange={(e) => setFieldSize(parseInt(e.target.value) || 50)}
                                    min="10"
                                    max="200"
                                />
                            </div>
                            <button
                                className="btn btn-success full-width"
                                onClick={processImages}
                                disabled={images.length === 0 || processing}
                            >
                                {processing ? 'Processing...' : 'Process Analysis'}
                            </button>
                            {processing && (
                                <div className="progress-bar-container">
                                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                </div>
                            )}
                            {status.processing && <div className="status-message info">{status.processing}</div>}
                        </div>
                    </div>

                    {/* Step 3: Results */}
                    <div className="step-card">
                        <div className="step-header">
                            <span className="step-number">3</span>
                            <h2>Results</h2>
                        </div>
                        <div className="step-body">
                            {status.results ? (
                                <div className="results-summary">{status.results}</div>
                            ) : (
                                <p className="no-results">No results yet</p>
                            )}
                            <button className="btn btn-outline full-width" onClick={clearResults}>
                                Reset Analysis
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="map-wrapper">
                <MapContainer
                    center={[33.5731, -7.5898]}
                    zoom={13}
                    maxZoom={20}
                    className="map-container"
                >
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer name="OpenStreetMap">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer checked name="Satellite">
                            <TileLayer
                                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                maxZoom={20}
                                maxNativeZoom={18}
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>
                    <DrawControls
                        onPolygonCreated={handlePolygonCreated}
                        onPolygonDeleted={handlePolygonDeleted}
                        featureGroupRef={featureGroupRef}
                        drawControlRef={drawControlRef}
                    />
                    <ResultMarkers markers={markers} />

                    {/* Render saved polygons */}
                    {/* We need these to be editable/deletable, so they should be inside FeatureGroup of EditControl. 
                        However, react-leaflet-draw doesn't easily support binding external state to its internal layers.
                        Workaround: We use a separate wrapper to add them to the FeatureGroup. 
                    */}
                    <SavedFieldsLayer
                        polygons={polygons}
                        featureGroupRef={featureGroupRef}
                    />
                </MapContainer>

                {/* Legend */}
                <div className="map-overlay-legend">
                    <h3>Stress Levels</h3>
                    <div className="legend-item">
                        <span className="dot orange"></span>
                        <span>Moderate (30-60%)</span>
                    </div>
                    <div className="legend-item">
                        <span className="dot red"></span>
                        <span>Severe (60-100%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
