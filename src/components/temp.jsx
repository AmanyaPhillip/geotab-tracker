import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import myMarkerIcon from '../assets/my-marker.png';

// Fix for default Leaflet marker icons not showing up with Webpack/Vite
delete L.Icon.Default.prototype._get;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const customIcon = L.icon({
    iconUrl: myMarkerIcon,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50],
});

function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, map.getZoom());
        }
    }, [center, map]);
    return null;
}

// === NEW HELPER FUNCTIONS FOR GEOSPACE CALCULATIONS ===

/**
 * Calculates the distance between two points on the Earth (Haversine formula).
 * Used for point-in-circle test.
 * @param {object} latlon1 - {latitude, longitude}
 * @param {object} latlon2 - {latitude, longitude}
 * @returns {number} Distance in meters
 */
function calculateDistance(latlon1, latlon2) {
    const R = 6371e3; // metres
    const φ1 = latlon1.latitude * Math.PI / 180; // φ, λ in radians
    const φ2 = latlon2.latitude * Math.PI / 180;
    const Δφ = (latlon2.latitude - latlon1.latitude) * Math.PI / 180;
    const Δλ = (latlon2.longitude - latlon1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param {object} point - {latitude, longitude}
 * @param {Array<Array<number>>} polygon - Array of [latitude, longitude] arrays
 * @returns {boolean} True if point is inside, false otherwise
 */
function isPointInPolygon(point, polygon) {
    // polygon is an array of [lat, lon] pairs
    let x = point.longitude, y = point.latitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i][1], yi = polygon[i][0]; // polygon coords are [lat, lon]
        let xj = polygon[j][1], yj = polygon[j][0]; // point coords are {latitude, longitude}

        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}


function VehicleMap({ selectedVehicleId, sessionInfo, commonStyles }) {
    const [vehicleLocation, setVehicleLocation] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const [zones, setZones] = useState([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);
    const [zonesError, setZonesError] = useState(null);

    // <<< NEW: State to hold the current geofence status
    const [currentGeofenceStatus, setCurrentGeofenceStatus] = useState("Determining status...");

    // Function to fetch vehicle location
    const fetchVehicleLocation = async () => {
        if (!sessionInfo || !sessionInfo.sessionId || !selectedVehicleId) {
            setVehicleLocation(null);
            setIsLoadingLocation(false);
            setCurrentGeofenceStatus("Not authenticated or no vehicle selected.");
            return;
        }

        setIsLoadingLocation(true);
        setLocationError(null);

        const apiUrl = `https://${sessionInfo.server}/apiv1/`;

        try {
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Get',
                params: {
                    typeName: 'DeviceStatusInfo',
                    search: {
                        deviceSearch: {
                            id: selectedVehicleId
                        }
                    },
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: 3,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = response.data.result;

            if (result && Array.isArray(result) && result.length > 0) {
                const latestStatus = result[0];
                const newLocation = {
                    latitude: latestStatus.latitude,
                    longitude: latestStatus.longitude,
                    speed: latestStatus.speed,
                    dateTime: latestStatus.dateTime,
                    ignition: latestStatus.ignition,
                    bearing: latestStatus.bearing
                };
                setVehicleLocation(newLocation);
                console.log('Vehicle location fetched:', latestStatus);

                // <<< NEW: Determine Geofence Status after fetching location
                let inZone = false;
                if (zones.length > 0) { // Only check if zones have been loaded
                    for (const zone of zones) {
                        const vehiclePoint = { latitude: newLocation.latitude, longitude: newLocation.longitude };

                        if (zone.geometryType === 'Polygon' && zone.points && zone.points.length > 0) {
                            const polygonPositionsForCheck = zone.points.map(point => [point.y, point.x]); // [lat, lon]
                            if (isPointInPolygon(vehiclePoint, polygonPositionsForCheck)) {
                                setCurrentGeofenceStatus(`Inside: ${zone.name}`);
                                inZone = true;
                                break; // Found a zone, no need to check others
                            }
                        } else if (zone.geometryType === 'Circle' && zone.center && zone.radius) {
                            const centerPoint = { latitude: zone.center.latitude, longitude: zone.center.longitude };
                            const distance = calculateDistance(vehiclePoint, centerPoint);
                            if (distance <= zone.radius) {
                                setCurrentGeofenceStatus(`Inside: ${zone.name}`);
                                inZone = true;
                                break; // Found a zone
                            }
                        }
                    }
                    if (!inZone) {
                        setCurrentGeofenceStatus("Outside all geofences");
                    }
                } else {
                    setCurrentGeofenceStatus("No geofences loaded or configured.");
                }


            } else if (response.data.error) {
                setLocationError(response.data.error.message || 'Failed to fetch vehicle location.');
                console.error('Geotab API Error fetching location:', response.data.error);
                setCurrentGeofenceStatus("Failed to get vehicle location.");
            } else {
                setLocationError('No location data found for this vehicle.');
                setVehicleLocation(null);
                setCurrentGeofenceStatus("No location data found.");
            }

        } catch (err) {
            console.error('Network or Request Error fetching location:', err);
            setLocationError('Could not fetch vehicle location. Please try again.');
            setCurrentGeofenceStatus("Error fetching location data.");
        } finally {
            setIsLoadingLocation(false);
        }
    };

    // Function to fetch zones
    const fetchZones = async () => {
        if (!sessionInfo || !sessionInfo.sessionId) {
            setZonesError('Session information is missing.');
            setIsLoadingZones(false);
            return;
        }

        setIsLoadingZones(true);
        setZonesError(null);

        const apiUrl = `https://${sessionInfo.server}/apiv1/`;

        try {
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Get',
                params: {
                    typeName: 'Zone',
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: 4,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = response.data.result;

            if (result) {
                setZones(result);
                console.log('Zones fetched:', result);
            } else if (response.data.error) {
                setZonesError(response.data.error.message || 'Failed to fetch zones.');
                console.error('Geotab API Error fetching zones:', response.data.error);
            } else {
                setZonesError('No zones found.');
                setZones([]);
            }
        } catch (err) {
            console.error('Network or Request Error fetching zones:', err);
            setZonesError('Could not fetch zones. Please try again.');
        } finally {
            setIsLoadingZones(false);
        }
    };

    // Effect for fetching zones (runs once when sessionInfo is available)
    useEffect(() => {
        if (sessionInfo) {
            fetchZones();
        }
    }, [sessionInfo]);

    // Effect for fetching vehicle location (manual refresh only)
    useEffect(() => {
        fetchVehicleLocation();
        // The currentGeofenceStatus will be updated within fetchVehicleLocation
    }, [selectedVehicleId, sessionInfo, zones]); // <<< NEW: Add 'zones' to dependency array
                                            // This ensures geofence status is re-evaluated
                                            // if zones are loaded/changed after initial location fetch.


    const defaultMapCenter = [45.4215, -75.6972]; // Ottawa, Canada
    const currentPosition = vehicleLocation ? [vehicleLocation.latitude, vehicleLocation.longitude] : defaultMapCenter;

    return (
        <div style={commonStyles.form}>
            <h2>Vehicle Location & Geofences</h2>
            {isLoadingLocation && <p>Loading vehicle location...</p>}
            {locationError && <p style={commonStyles.error}>Error: {locationError}</p>}
            {isLoadingZones && <p>Loading geofences...</p>}
            {zonesError && <p style={commonStyles.error}>Error: {zonesError}</p>}

            {!isLoadingLocation && !locationError && selectedVehicleId && (
                <>
                    <div style={styles.mapContainer}>
                        <MapContainer center={currentPosition} zoom={13} style={styles.map}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                            />

                            {/* Render Zones */}
                            {zones.map(zone => {
                                const zoneColor = zone.color || '#646cff';
                                const fillOpacity = 0.2;
                                const strokeOpacity = 0.8;

                                if (zone.geometryType === 'Polygon' && zone.points && zone.points.length > 0) {
                                    const polygonPositions = zone.points.map(point => [point.y, point.x]);
                                    // console.log(`Rendering Polygon: ${zone.name}`, polygonPositions);
                                    return (
                                        <Polygon
                                            key={zone.id}
                                            positions={polygonPositions}
                                            pathOptions={{ color: zoneColor, fillColor: zoneColor, fillOpacity, weight: 2, opacity: strokeOpacity }}
                                        >
                                            <Popup>Zone: {zone.name}</Popup>
                                        </Polygon>
                                    );
                                } else if (zone.geometryType === 'Circle' && zone.center && zone.radius) {
                                    // console.log(`Rendering Circle: ${zone.name}`, zone.center, zone.radius);
                                    return (
                                        <Circle
                                            key={zone.id}
                                            center={[zone.center.latitude, zone.center.longitude]}
                                            radius={zone.radius}
                                            pathOptions={{ color: zoneColor, fillColor: zoneColor, fillOpacity, weight: 2, opacity: strokeOpacity }}
                                        >
                                            <Popup>Zone: {zone.name} (Radius: {zone.radius}m)</Popup>
                                        </Circle>
                                    );
                                }
                                return null;
                            })}

                            {vehicleLocation && (
                                <Marker position={currentPosition} icon={customIcon}>
                                    <Popup>
                                        Vehicle ID: {selectedVehicleId} <br/>
                                        Speed: {vehicleLocation.speed ? vehicleLocation.speed.toFixed(1) : 'N/A'} km/h <br/>
                                        Time: {new Date(vehicleLocation.dateTime).toLocaleTimeString()} <br/>
                                        Date: {new Date(vehicleLocation.dateTime).toLocaleDateString()}
                                        {/* NEW: Display Geofence status in Popup */}
                                        <br/> <strong>Geofence:</strong> {currentGeofenceStatus}
                                    </Popup>
                                </Marker>
                            )}
                            <MapUpdater center={currentPosition} />
                        </MapContainer>
                    </div>
                    {vehicleLocation && (
                        <div style={styles.infoActionWrapper}>
                            <div style={styles.infoBox}>
                                <p><strong>Last Updated:</strong> {new Date(vehicleLocation.dateTime).toLocaleString()}</p>
                                <p><strong>Speed:</strong> {vehicleLocation.speed ? vehicleLocation.speed.toFixed(1) : 'N/A'} km/h</p>
                                <p><strong>Ignition:</strong> {vehicleLocation.ignition ? 'On' : 'Off'}</p>
                                <p><strong>Coordinates:</strong> {vehicleLocation.latitude.toFixed(4)}, {vehicleLocation.longitude.toFixed(4)}</p>
                                {/* NEW: Display current geofence status */}
                                <p><strong>Geofence Status:</strong> {currentGeofenceStatus}</p>
                            </div>
                            <button
                                style={{
                                    ...commonStyles.button,
                                    width: '100%',
                                    marginTop: '1em',
                                    marginBottom: '0.5em'
                                }}
                                onClick={fetchVehicleLocation}
                                disabled={isLoadingLocation}
                            >
                                {isLoadingLocation ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                    )}
                    {!vehicleLocation && <p>No real-time location data available for this vehicle yet.</p>}
                </>
            )}
        </div>
    );
}

const styles = {
    mapContainer: {
        width: '100%',
        height: '400px',
        marginBottom: '15px',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    infoBox: {
        backgroundColor: '#f0f0f0',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '0.9em',
        width: 'auto',
        minWidth: '120px',
        maxWidth: '350px',
        textAlign: 'center',
        display: 'inline-block',
        marginBottom: '0.5em',
    },
    infoActionWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    },
};

export default VehicleMap;