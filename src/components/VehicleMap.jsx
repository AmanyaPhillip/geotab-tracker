// VehicleMap.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Import functions from the new utility file
import {
    fetchFaultCodes,
    calculateDistance,
    isPointInPolygon,
    fetchOdometer,
    fetchFuelConsumption,
    calculateFuelEfficiency
} from './vehicleUtils';

// Import components and styles from the new MapComponents file
import { MapUpdater, FaultDetailModal, customIcon, styles } from './MapComponents';


function VehicleMap({ selectedVehicleId, sessionInfo, commonStyles, selectedTrip }) {
    const [vehicleLocation, setVehicleLocation] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const [zones, setZones] = useState([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);
    const [zonesError, setZonesError] = useState(null);

    const [currentGeofenceStatus, setCurrentGeofenceStatus] = useState("Determining status...");

    const [fuelData, setFuelData] = useState({
        totalFuel: null,
        fuelLevel: null,
        fuelEfficiency: null,
        lastUpdated: null
    });
    const [isLoadingFuel, setIsLoadingFuel] = useState(false);

    const [groupedFaultCodes, setGroupedFaultCodes] = useState([]);
    const [isLoadingFaults, setIsLoadingFaults] = useState(false);
    const [faultsError, setFaultsError] = useState(null);
    const [selectedFaultGroup, setSelectedFaultGroup] = useState(null);

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
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                }),
            });
            const data = await response.json();
            const result = data.result;

            if (result) {
                setZones(result);
            } else if (data.error) {
                setZonesError(data.error.message || 'Failed to fetch zones.');
                console.error('Geotab API Error fetching zones:', data.error);
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

    const fetchVehicleLocation = async () => {
        if (!sessionInfo || !selectedVehicleId) {
            setVehicleLocation(null);
            setIsLoadingLocation(false);
            setLocationError(null);
            setCurrentGeofenceStatus("Not authenticated or no vehicle selected.");
            return;
        }

        setIsLoadingLocation(true);
        setLocationError(null);

        const apiUrl = `https://${sessionInfo.server}/apiv1/`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'Get',
                    params: {
                        typeName: 'DeviceStatusInfo',
                        search: {
                            deviceSearch: { id: selectedVehicleId }
                        },
                        resultsLimit: 1,
                        credentials: {
                            database: sessionInfo.database,
                            userName: sessionInfo.userName,
                            sessionId: sessionInfo.sessionId,
                        },
                    },
                    id: 3,
                }),
            });

            const data = await response.json();
            const result = data.result;
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
            } else {
                setVehicleLocation(null);
                console.log('No DeviceStatusInfo found for this vehicle.');
            }
        } catch (err) {
            console.error('Error fetching vehicle location:', err);
            setLocationError('Could not fetch vehicle location. Please try again.');
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const fetchFuelData = async () => {
        if (!sessionInfo || !selectedVehicleId) {
            return;
        }

        setIsLoadingFuel(true);

        try {
            const currentFuel = await fetchFuelConsumption(sessionInfo, selectedVehicleId);
            const efficiency = await calculateFuelEfficiency(sessionInfo, selectedVehicleId, 24);

            setFuelData({
                ...currentFuel,
                fuelEfficiency: efficiency
            });

        } catch (err) {
            console.error('Error fetching fuel data:', err);
        } finally {
            setIsLoadingFuel(false);
        }
    };

    const fetchFaultData = async () => {
        if (!sessionInfo || !selectedVehicleId) {
            return;
        }

        setIsLoadingFaults(true);
        setFaultsError(null);

        try {
            const groupedFaults = await fetchFaultCodes(sessionInfo, selectedVehicleId);
            setGroupedFaultCodes(groupedFaults);
        } catch (err) {
            console.error('Error fetching fault codes:', err);
            setFaultsError(err.message || 'Failed to fetch fault codes');
        } finally {
            setIsLoadingFaults(false);
        }
    };

    useEffect(() => {
        fetchVehicleLocation();
        fetchFuelData();
        fetchFaultData();
    }, [selectedVehicleId, sessionInfo]);

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

    const defaultMapCenter = [45.4215, -75.6972];
    const currentPosition = vehicleLocation ? [vehicleLocation.latitude, vehicleLocation.longitude] : defaultMapCenter;

    const getTripPolyline = (trip) => {
        if (trip && Array.isArray(trip.path) && trip.path.length > 0) {
            const validPath = trip.path.filter(p =>
                Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'
            );
            return validPath;
        }
        return [];
    };

    const tripPolylinePositions = getTripPolyline(selectedTrip);

    const formatFuelDisplay = () => {
        if (isLoadingFuel) return 'Loading...';

        const parts = [];

        if (fuelData.totalFuel !== null) {
            parts.push(`Total: ${fuelData.totalFuel.toFixed(1)}L`);
        }

        if (fuelData.fuelLevel !== null) {
            const levelValue = fuelData.fuelLevel <= 100 ?
                `${fuelData.fuelLevel.toFixed(1)}%` :
                `${fuelData.fuelLevel.toFixed(1)}L`;
            parts.push(`Level: ${levelValue}`);
        }

        if (fuelData.fuelEfficiency && fuelData.fuelEfficiency.efficiency) {
            parts.push(`Efficiency: ${fuelData.fuelEfficiency.efficiency.toFixed(2)}L/100km`);
        }

        return parts.length > 0 ? parts.join(' | ') : 'N/A';
    };

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
                                        <br/> <strong>Fuel:</strong> {formatFuelDisplay()}
                                    </Popup>
                                </Marker>
                            )}

                            {tripPolylinePositions.length > 0 && (
                                <>
                                    <Polyline
                                        positions={tripPolylinePositions}
                                        pathOptions={{ color: 'orange', weight: 4, opacity: 0.8 }}
                                    />
                                </>
                            )}

                            <MapUpdater center={currentPosition} polylinePositions={tripPolylinePositions} />
                        </MapContainer>
                    </div>
                    {vehicleLocation && (
                        <div style={styles.infoActionWrapper}>
                            <div style={styles.dataCardsContainer}>
                                {/* Vehicle Info Card */}
                                <div style={styles.infoBox}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                                        Vehicle Information
                                    </p>
                                    <p><strong>Last Updated:</strong> {new Date(vehicleLocation.dateTime).toLocaleString()}</p>
                                    <p><strong>Speed:</strong> {vehicleLocation.speed ? vehicleLocation.speed.toFixed(1) : 'N/A'} km/h</p>
                                    <p><strong>Ignition:</strong> {vehicleLocation.ignition ? 'On' : 'Off'}</p>
                                    <p><strong>Fuel:</strong> {formatFuelDisplay()}</p>
                                    <p>
                                        <strong>Odometer:</strong> {
                                            vehicleLocation.odometer !== undefined && vehicleLocation.odometer !== null
                                            ? (vehicleLocation.odometer / 1000).toFixed(2) + ' km'
                                            : 'N/A'
                                        }
                                    </p>
                                    <p><strong>Geofence Status:</strong> {currentGeofenceStatus}</p>
                                    {fuelData.fuelEfficiency && (
                                        <div style={{ marginTop: '10px', fontSize: '0.85em', color: '#666' }}>
                                            <p><strong>24h Fuel Stats:</strong></p>
                                            <p>Distance: {fuelData.fuelEfficiency.distance.toFixed(1)} km</p>
                                            <p>Fuel Used: {fuelData.fuelEfficiency.fuelUsed.toFixed(2)} L</p>
                                            <p>Efficiency: {fuelData.fuelEfficiency.efficiency.toFixed(2)} L/100km</p>
                                        </div>
                                    )}
                                </div>

                                {/* ENHANCED: Fault Codes Card with click functionality and grouping */}
                                <div style={styles.faultCodesBox}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '5px', textAlign: 'center' }}>
                                        Fault Codes
                                    </p>
                                    {isLoadingFaults && <p style={{ fontSize: '0.8em', color: '#666' }}>Loading fault codes...</p>}
                                    {faultsError && <p style={{ fontSize: '0.8em', color: 'red' }}>Error: {faultsError}</p>}
                                    {!isLoadingFaults && !faultsError && (
                                        <div style={styles.faultCodesContent}>
                                            {groupedFaultCodes.length === 0 ? (
                                                <p style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>No fault codes found</p>
                                            ) : (
                                                <div style={styles.faultCodesList}>
                                                    {groupedFaultCodes.slice(0, 8).map((faultGroup, index) => (
                                                        <div
                                                            key={index}
                                                            className="fault-group-item" // Add class for hover effect
                                                            style={styles.faultGroupItem}
                                                            onClick={() => setSelectedFaultGroup(faultGroup)}
                                                        >
                                                            <div style={styles.faultGroupHeader}>
                                                                <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: '#333' }}>
                                                                    {faultGroup.diagnosticName}
                                                                </div>
                                                                <div style={styles.faultBadges}>
                                                                    {faultGroup.activeFaults > 0 && (
                                                                        <span style={styles.activeBadge}>
                                                                            {faultGroup.activeFaults} Active
                                                                        </span>
                                                                    )}
                                                                    {faultGroup.inactiveFaults > 0 && (
                                                                        <span style={styles.inactiveBadge}>
                                                                            {faultGroup.inactiveFaults} Inactive
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div style={styles.faultGroupDetails}>
                                                                <div style={{ fontSize: '0.7em', color: '#666' }}>
                                                                    Total: {faultGroup.count} occurrence{faultGroup.count !== 1 ? 's' : ''}
                                                                </div>
                                                                <div style={{ fontSize: '0.7em', color: '#666' }}>
                                                                    Latest: {new Date(faultGroup.mostRecentDate).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <div style={styles.clickHint}>
                                                                Click for details →
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {groupedFaultCodes.length > 8 && (
                                                        <div style={{ fontSize: '0.75em', color: '#666', textAlign: 'center', marginTop: '5px' }}>
                                                            ...and {groupedFaultCodes.length - 8} more fault groups
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    fetchVehicleLocation();
                                    fetchFuelData();
                                    fetchFaultData();
                                }}
                                style={commonStyles.button}
                                disabled={isLoadingLocation || isLoadingFuel || isLoadingFaults}
                            >
                                {(isLoadingLocation || isLoadingFuel || isLoadingFaults) ? 'Refreshing...' : 'Refresh Location, Fuel & Faults'}
                            </button>
                        </div>
                    )}
                    {!vehicleLocation && <p>No real-time location data available for this vehicle yet. Click 'Refresh Location, Fuel & Faults' to fetch it.</p>}
                </>
            )}

            {/* ENHANCED: Fault Detail Modal */}
            {selectedFaultGroup && (
                <FaultDetailModal
                    faultGroup={selectedFaultGroup}
                    onClose={() => setSelectedFaultGroup(null)}
                />
            )}
        </div>
    );
}

export default VehicleMap;