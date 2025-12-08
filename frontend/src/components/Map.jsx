import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

// Fix Leaflet marker icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapComponent = ({ zones, onZoneSelect }) => {
    // Center roughly on a demo location
    const position = [45.0, -0.5];

    return (
        <MapContainer center={position} zoom={13} style={{ height: '600px', width: '100%', borderRadius: '12px' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {zones.map((zone) => (
                <Marker
                    key={zone.id}
                    position={[zone.lat, zone.lon]}
                    eventHandlers={{
                        click: () => onZoneSelect(zone),
                    }}
                >
                    <Popup>
                        <strong>Zone: {zone.id}</strong><br />
                        Status: {zone.status}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};

export default MapComponent;
