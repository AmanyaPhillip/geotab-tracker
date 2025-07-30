// VehicleMap.jsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline, useMap } from 'react-leaflet';
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

// MODIFIED MapUpdater to fit bounds
function MapUpdater({ center, polylinePositions }) {
    const map = useMap();
    useEffect(() => {
        if (polylinePositions && polylinePositions.length > 0) {
            // Create a LatLngBounds object from the polyline positions
            const bounds = L.latLngBounds(polylinePositions);
            map.fitBounds(bounds, { padding: [50, 50] }); // Add some padding
        } else if (center) {
            map.flyTo(center, map.getZoom());
        }
    }, [center, polylinePositions, map]); // Add polylinePositions to dependency array
    return null;
}

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
    let x = point.longitude, y = point.latitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i][1], yi = polygon[i][0];
        let xj = polygon[j][1], yj = polygon[j][0];

        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

async function fetchOdometer(sessionInfo, deviceId) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;
    const diagnostics = [
        "DiagnosticOdometerId",
        "DiagnosticOBDOdometerReaderId",
        "DiagnosticJ1939TotalVehicleDistanceId",
        "DiagnosticJ1708TotalVehicleDistanceId",
        "DiagnosticOdometerAdjustmentId"
    ];
    // Fetch odometer data from the last 24 hours to find the latest
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    let latestOdometer = null;

    for (const diagId of diagnostics) {
        try {
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Get',
                params: {
                    typeName: 'StatusData',
                    search: {
                        deviceSearch: { id: deviceId },
                        diagnosticSearch: { id: diagId },
                        fromDate,
                        toDate
                    },
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: Math.floor(Math.random() * 10000),
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const result = response.data.result;
            if (result && result.length > 0) {
                // Sort by dateTime descending to get the latest
                const sorted = result.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
                if (sorted[0].data !== undefined && sorted[0].data !== null) {
                    latestOdometer = sorted[0].data;
                    break; // Found an odometer, no need to check other diagnostics
                }
            }
        } catch (err) {
            // Ignore errors for missing diagnostics, try the next one
            console.warn(`Could not fetch odometer for ${diagId}:`, err.message);
        }
    }
    return latestOdometer;
}

function VehicleMap({ selectedVehicleId, sessionInfo, commonStyles, selectedTrip }) {
    console.log('VehicleMap: selectedTrip prop:', selectedTrip);

    const [vehicleLocation, setVehicleLocation] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const [zones, setZones] = useState([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);
    const [zonesError, setZonesError] = useState(null);

    const [currentGeofenceStatus, setCurrentGeofenceStatus] = useState("Determining status...");

    // Function to fetch zones (runs once when sessionInfo is available)
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

    useEffect(() => {
        if (sessionInfo) {
            fetchZones();
        }
    }, [sessionInfo]);

    // Function to fetch the latest vehicle location manually
    const fetchVehicleLocation = async () => {
        if (!sessionInfo || !selectedVehicleId) {
            setVehicleLocation(null);
            setIsLoadingLocation(false);
            setLocationError(null); // Clear any previous errors
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
                        deviceSearch: { id: selectedVehicleId }
                    },
                    resultsLimit: 1, // Only interested in the latest one
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: 3,
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const result = response.data.result;
            if (result && result.length > 0) {
                const latestStatus = result[0];
                let odometer = latestStatus.odometer;
                if (odometer === undefined || odometer === null) {
                    odometer = await fetchOdometer(sessionInfo, selectedVehicleId);
                }
                setVehicleLocation({
                    latitude: latestStatus.latitude,
                    longitude: latestStatus.longitude,
                    speed: latestStatus.speed,
                    dateTime: latestStatus.dateTime,
                    ignition: latestStatus.ignition,
                    bearing: latestStatus.bearing,
                    odometer
                });
                console.log('Vehicle location fetched:', latestStatus);
            } else {
                setVehicleLocation(null); // No data found
                console.log('No DeviceStatusInfo found for this vehicle.');
            }
        } catch (err) {
            console.error('Error fetching vehicle location:', err);
            setLocationError('Could not fetch vehicle location. Please try again.');
        } finally {
            setIsLoadingLocation(false);
        }
    };

    // Fetch initial location when selectedVehicleId or sessionInfo changes
    useEffect(() => {
        fetchVehicleLocation();
    }, [selectedVehicleId, sessionInfo]);

    // Effect to determine Geofence Status whenever vehicleLocation or zones change
    useEffect(() => {
        if (!vehicleLocation) {
            setCurrentGeofenceStatus("No location data available.");
            return;
        }

        let inZone = false;
        if (zones.length > 0) {
            for (const zone of zones) {
                const vehiclePoint = { latitude: vehicleLocation.latitude, longitude: vehicleLocation.longitude };

                if (zone.geometryType === 'Polygon' && zone.points && zone.points.length > 0) {
                    const polygonPositionsForCheck = zone.points.map(point => [point.y, point.x]);
                    if (isPointInPolygon(vehiclePoint, polygonPositionsForCheck)) {
                        setCurrentGeofenceStatus(`Inside: ${zone.name}`);
                        inZone = true;
                        break;
                    }
                } else if (zone.geometryType === 'Circle' && zone.center && zone.radius) {
                    const centerPoint = { latitude: zone.center.latitude, longitude: zone.center.longitude };
                    const distance = calculateDistance(vehiclePoint, centerPoint);
                    if (distance <= zone.radius) {
                        setCurrentGeofenceStatus(`Inside: ${zone.name}`);
                        inZone = true;
                        break;
                    }
                }
            }
            if (!inZone) {
                setCurrentGeofenceStatus("Outside all geofences");
            }
        } else {
            setCurrentGeofenceStatus("No geofences loaded or configured.");
        }
    }, [vehicleLocation, zones]);


    const defaultMapCenter = [45.4215, -75.6972]; // Ottawa, Canada
    const currentPosition = vehicleLocation ? [vehicleLocation.latitude, vehicleLocation.longitude] : defaultMapCenter;

    // Helper to get polyline from trip data
    const getTripPolyline = (trip) => {
        // We expect trip.path to already be in the format [[lat, lng], [lat, lng], ...]
        // from PastTripsCard.jsx. Let's directly use it if it's valid.
        if (trip && Array.isArray(trip.path) && trip.path.length > 0) {
            // Further filter to ensure each sub-array truly contains two numbers
            const validPath = trip.path.filter(p =>
                Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'
            );
            return validPath;
        }
        return [];
    };

    const tripPolylinePositions = getTripPolyline(selectedTrip);

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
                                    const polygonPositionsForCheck = zone.points.map(point => [point.y, point.x]);
                                    return (
                                        <Polygon
                                            key={zone.id}
                                            positions={polygonPositionsForCheck}
                                            pathOptions={{ color: zoneColor, fillColor: zoneColor, fillOpacity, weight: 2, opacity: strokeOpacity }}
                                        >
                                            <Popup>Zone: {zone.name}</Popup>
                                        </Polygon>
                                    );
                                } else if (zone.geometryType === 'Circle' && zone.center && zone.radius) {
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
                                        <br/> <strong>Geofence:</strong> {currentGeofenceStatus}
                                    </Popup>
                                </Marker>
                            )}

                            {/* Render selected trip polyline if available */}
                            {tripPolylinePositions.length > 0 && (
                                <>
                                    {console.log('VehicleMap: Rendering Polyline with positions:', tripPolylinePositions)}
                                    <Polyline
                                        positions={tripPolylinePositions}
                                        pathOptions={{ color: 'orange', weight: 4, opacity: 0.8 }}
                                    />
                                </>
                            )}

                            {/* Pass tripPolylinePositions to MapUpdater */}
                            <MapUpdater center={currentPosition} polylinePositions={tripPolylinePositions} />
                        </MapContainer>
                    </div>
                    {vehicleLocation && (
                        <div style={styles.infoActionWrapper}>
                            <div style={styles.infoBox}>
                                <p><strong>Last Updated:</strong> {new Date(vehicleLocation.dateTime).toLocaleString()}</p>
                                <p><strong>Speed:</strong> {vehicleLocation.speed ? vehicleLocation.speed.toFixed(1) : 'N/A'} km/h</p>
                                <p><strong>Ignition:</strong> {vehicleLocation.ignition ? 'On' : 'Off'}</p>
                                <p>
                                    <strong>Fuel:</strong> {
                                        vehicleLocation.fuelUsed !== undefined ? `${vehicleLocation.fuelUsed} L` :
                                        vehicleLocation.fuel !== undefined ? `${vehicleLocation.fuel} L` :
                                        vehicleLocation.fuelLevel !== undefined ? `${vehicleLocation.fuelLevel} %` :
                                        'N/A'
                                    }
                                </p>
                                <p>
                                    <strong>Odometer:</strong> {
                                        vehicleLocation.odometer !== undefined && vehicleLocation.odometer !== null
                                        ? (vehicleLocation.odometer / 1000).toFixed(2) + ' km'
                                        : 'N/A'
                                    }
                                </p>
                                <p><strong>Geofence Status:</strong> {currentGeofenceStatus}</p>
                            </div>
                            <button onClick={fetchVehicleLocation} style={commonStyles.button}>Refresh Location</button>
                        </div>
                    )}
                    {!vehicleLocation && <p>No real-time location data available for this vehicle yet. Click 'Refresh Location' to fetch it.</p>}
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