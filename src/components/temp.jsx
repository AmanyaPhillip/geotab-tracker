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
            const bounds = L.latLngBounds(polylinePositions);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center) {
            map.flyTo(center, map.getZoom());
        }
    }, [center, polylinePositions, map]);
    return null;
}

// Enhanced function to fetch fault codes with more detailed information
async function fetchFaultCodes(sessionInfo, deviceId) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;
    
    try {
        const response = await axios.post(apiUrl, {
            jsonrpc: '2.0',
            method: 'Get',
            params: {
                typeName: 'FaultData',
                search: {
                    deviceSearch: { id: deviceId },
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
        if (result) {
            // Sort fault codes by date, most recent first
            const sortedFaults = result.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
            
            // Group faults by diagnostic name/code
            const groupedFaults = groupFaultsByDiagnostic(sortedFaults);
            
            return groupedFaults;
        } else if (response.data.error) {
            console.error('Geotab API Error fetching fault codes:', response.data.error);
            throw new Error(response.data.error.message || 'Failed to fetch fault codes.');
        }
        return [];
    } catch (err) {
        console.error('Error fetching fault codes:', err);
        throw err;
    }
}

// Function to group faults by diagnostic name/code
function groupFaultsByDiagnostic(faults) {
    const grouped = {};
    
    faults.forEach(fault => {
        const diagnosticKey = fault.diagnostic?.name || fault.diagnostic?.id || 'Unknown';
        
        if (!grouped[diagnosticKey]) {
            grouped[diagnosticKey] = {
                diagnosticName: diagnosticKey,
                diagnosticId: fault.diagnostic?.id,
                diagnosticCode: fault.diagnostic?.code,
                count: 0,
                activeFaults: 0,
                inactiveFaults: 0,
                mostRecentDate: fault.dateTime,
                oldestDate: fault.dateTime,
                faultInstances: []
            };
        }
        
        const group = grouped[diagnosticKey];
        group.count++;
        
        if (fault.faultState === 'Active') {
            group.activeFaults++;
        } else {
            group.inactiveFaults++;
        }
        
        // Update date ranges
        if (new Date(fault.dateTime) > new Date(group.mostRecentDate)) {
            group.mostRecentDate = fault.dateTime;
        }
        if (new Date(fault.dateTime) < new Date(group.oldestDate)) {
            group.oldestDate = fault.dateTime;
        }
        
        // Store detailed fault instance
        group.faultInstances.push({
            id: fault.id,
            dateTime: fault.dateTime,
            faultState: fault.faultState,
            malformedId: fault.malformedId,
            dismissDateTime: fault.dismissDateTime,
            dismissUser: fault.dismissUser,
            amberWarningLamp: fault.amberWarningLamp,
            redStopLamp: fault.redStopLamp,
            protectWarningLamp: fault.protectWarningLamp,
            count: fault.count,
            controller: fault.controller,
            failureMode: fault.failureMode,
            sourceAddress: fault.sourceAddress,
            spn: fault.spn,
            fmi: fault.fmi
        });
    });
    
    // Convert to array and sort by most recent activity
    return Object.values(grouped).sort((a, b) => 
        new Date(b.mostRecentDate) - new Date(a.mostRecentDate)
    );
}

// NEW: Fault Detail Modal Component
function FaultDetailModal({ faultGroup, onClose }) {
    if (!faultGroup) return null;
    
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <h3 style={{ margin: 0, color: '#213547' }}>
                        {faultGroup.diagnosticName}
                    </h3>
                    <button 
                        onClick={onClose}
                        style={styles.closeButton}
                    >
                        ×
                    </button>
                </div>
                
                <div style={styles.modalBody}>
                    <div style={styles.summarySection}>
                        <h4>Summary</h4>
                        <div style={styles.summaryGrid}>
                            <div><strong>Total Occurrences:</strong> {faultGroup.count}</div>
                            <div><strong>Active:</strong> {faultGroup.activeFaults}</div>
                            <div><strong>Inactive:</strong> {faultGroup.inactiveFaults}</div>
                            <div><strong>Diagnostic ID:</strong> {faultGroup.diagnosticId || 'N/A'}</div>
                            <div><strong>Code:</strong> {faultGroup.diagnosticCode || 'N/A'}</div>
                            <div><strong>Date Range:</strong> {new Date(faultGroup.oldestDate).toLocaleDateString()} - {new Date(faultGroup.mostRecentDate).toLocaleDateString()}</div>
                        </div>
                    </div>
                    
                    <div style={styles.instancesSection}>
                        <h4>Recent Instances (Last 10)</h4>
                        <div style={styles.instancesList}>
                            {faultGroup.faultInstances.slice(0, 10).map((instance, index) => (
                                <div key={index} style={styles.instanceItem}>
                                    <div style={styles.instanceHeader}>
                                        <span style={{ 
                                            ...styles.statusBadge, 
                                            backgroundColor: instance.faultState === 'Active' ? '#dc3545' : '#28a745' 
                                        }}>
                                            {instance.faultState}
                                        </span>
                                        <span style={styles.instanceDate}>
                                            {new Date(instance.dateTime).toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div style={styles.instanceDetails}>
                                        {instance.spn && <div><strong>SPN:</strong> {instance.spn}</div>}
                                        {instance.fmi && <div><strong>FMI:</strong> {instance.fmi}</div>}
                                        {instance.sourceAddress && <div><strong>Source Address:</strong> {instance.sourceAddress}</div>}
                                        {instance.failureMode && <div><strong>Failure Mode:</strong> {instance.failureMode}</div>}
                                        {instance.controller && <div><strong>Controller:</strong> {instance.controller.name || instance.controller.id}</div>}
                                        {instance.count && <div><strong>Count:</strong> {instance.count}</div>}
                                        {instance.dismissDateTime && (
                                            <div><strong>Dismissed:</strong> {new Date(instance.dismissDateTime).toLocaleString()}</div>
                                        )}
                                        {instance.dismissUser && (
                                            <div><strong>Dismissed by:</strong> {instance.dismissUser.name || instance.dismissUser.id}</div>
                                        )}
                                        <div style={styles.lampStatus}>
                                            {instance.amberWarningLamp && <span style={styles.amberLamp}>⚠️ Amber</span>}
                                            {instance.redStopLamp && <span style={styles.redLamp}>🛑 Red Stop</span>}
                                            {instance.protectWarningLamp && <span style={styles.protectLamp}>🛡️ Protect</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Calculates the distance between two points on the Earth (Haversine formula).
 */
function calculateDistance(latlon1, latlon2) {
    const R = 6371e3; // metres
    const φ1 = latlon1.latitude * Math.PI / 180;
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
                const sorted = result.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
                if (sorted[0].data !== undefined && sorted[0].data !== null) {
                    latestOdometer = sorted[0].data;
                    break;
                }
            }
        } catch (err) {
            console.warn(`Could not fetch odometer for ${diagId}:`, err.message);
        }
    }
    return latestOdometer;
}

async function fetchFuelConsumption(sessionInfo, deviceId) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;
    
    const fuelDiagnostics = [
        "DiagnosticDeviceTotalFuelId",
        "DiagnosticFuelUsedId",
        "DiagnosticFuelLevelId",
        "DiagnosticOBDFuelLevelInputId",
        "DiagnosticJ1939FuelLevelId",
        "DiagnosticJ1708FuelLevelId"
    ];

    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    let fuelData = {
        totalFuel: null,
        fuelLevel: null,
        fuelEfficiency: null,
        lastUpdated: null
    };

    for (const diagId of fuelDiagnostics) {
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
                const sorted = result.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
                const latestReading = sorted[0];
                
                if (latestReading.data !== undefined && latestReading.data !== null) {
                    if (diagId.includes('TotalFuel') || diagId.includes('FuelUsed')) {
                        fuelData.totalFuel = latestReading.data;
                        fuelData.lastUpdated = latestReading.dateTime;
                    } else if (diagId.includes('FuelLevel')) {
                        fuelData.fuelLevel = latestReading.data;
                        fuelData.lastUpdated = latestReading.dateTime;
                    }
                }
            }
        } catch (err) {
            console.warn(`Could not fetch fuel data for ${diagId}:`, err.message);
        }
    }

    return fuelData;
}

async function calculateFuelEfficiency(sessionInfo, deviceId, hours = 24) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    try {
        const response = await axios.post(apiUrl, {
            jsonrpc: '2.0',
            method: 'MultiCall',
            params: {
                calls: [
                    {
                        method: 'Get',
                        params: {
                            typeName: 'StatusData',
                            search: {
                                fromDate,
                                toDate,
                                diagnosticSearch: { id: 'DiagnosticOdometerAdjustmentId' },
                                deviceSearch: { id: deviceId }
                            }
                        }
                    },
                    {
                        method: 'Get',
                        params: {
                            typeName: 'StatusData',
                            search: {
                                fromDate,
                                toDate,
                                diagnosticSearch: { id: 'DiagnosticDeviceTotalFuelId' },
                                deviceSearch: { id: deviceId }
                            }
                        }
                    }
                ],
                credentials: {
                    database: sessionInfo.database,
                    userName: sessionInfo.userName,
                    sessionId: sessionInfo.sessionId,
                }
            },
            id: Math.floor(Math.random() * 10000),
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const results = response.data.result;
        
        if (results && results.length >= 2) {
            const odometerData = results[0];
            const fuelUsedData = results[1];

            if (odometerData.length === 0 || fuelUsedData.length === 0) {
                return null;
            }

            const sortedOdometer = odometerData.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
            const sortedFuel = fuelUsedData.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

            const distance = sortedOdometer[sortedOdometer.length - 1].data - sortedOdometer[0].data;
            const fuelUsed = sortedFuel[sortedFuel.length - 1].data - sortedFuel[0].data;

            if (distance === 0) {
                return null;
            }

            const efficiency = (fuelUsed / (distance / 1000)) * 100;
            
            return {
                efficiency: efficiency,
                distance: distance / 1000,
                fuelUsed: fuelUsed,
                period: hours
            };
        }
    } catch (err) {
        console.warn("Could not calculate fuel efficiency:", err.message);
    }
    
    return null;
}

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

    // ENHANCED: State for grouped fault codes and modal
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
            const response = await axios.post(apiUrl, {
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

    // ENHANCED: Function to fetch grouped fault data
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
    infoActionWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    },
    dataCardsContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch', // MODIFIED: Changed from 'flex-start' to 'stretch' to make cards same height
        gap: '15px',
        width: '100%',
        marginBottom: '0.5em',
        flexWrap: 'wrap',
    },
    infoBox: {
        backgroundColor: '#f0f0f0',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '0.9em',
        width: 'auto',
        minWidth: '250px',
        maxWidth: '350px',
        textAlign: 'center',
        display: 'flex', // MODIFIED: Added flex display
        flexDirection: 'column', // MODIFIED: Stack content vertically
        flex: '1',
    },
    faultCodesBox: {
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '0.9em',
        width: 'auto',
        minWidth: '250px',
        maxWidth: '350px',
        textAlign: 'left',
        display: 'flex', // MODIFIED: Added flex display
        flexDirection: 'column', // MODIFIED: Stack content vertically
        flex: '1',
        border: '1px solid #e9ecef',
    },
    faultCodesContent: {
        flex: 1, // MODIFIED: Take up remaining space
        overflowY: 'auto',
        maxHeight: 'none', // MODIFIED: Remove max height restriction
    },
    faultCodesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    // ENHANCED: New styles for grouped fault items
    faultGroupItem: {
        padding: '8px',
        backgroundColor: '#fff',
        borderRadius: '4px',
        border: '1px solid #e9ecef',
        fontSize: '0.8em',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
    },
    faultGroupHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
    },
    faultBadges: {
        display: 'flex',
        gap: '4px',
    },
    activeBadge: {
        backgroundColor: '#dc3545',
        color: 'white',
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '0.7em',
        fontWeight: 'bold',
    },
    inactiveBadge: {
        backgroundColor: '#28a745',
        color: 'white',
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '0.7em',
        fontWeight: 'bold',
    },
    faultGroupDetails: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '4px',
    },
    clickHint: {
        fontSize: '0.7em',
        color: '#007bff',
        textAlign: 'right',
        fontStyle: 'italic',
    },
    // ENHANCED: Modal styles
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90%',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#666',
        padding: '0',
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        padding: '20px',
        overflowY: 'auto',
        maxHeight: 'calc(90vh - 120px)',
    },
    summarySection: {
        marginBottom: '20px',
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '0.9em',
    },
    instancesSection: {
        marginTop: '20px',
    },
    instancesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '400px',
        overflowY: 'auto',
    },
    instanceItem: {
        padding: '10px',
        border: '1px solid #e9ecef',
        borderRadius: '4px',
        backgroundColor: '#f8f9fa',
    },
    instanceHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    statusBadge: {
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75em',
        fontWeight: 'bold',
    },
    instanceDate: {
        fontSize: '0.8em',
        color: '#666',
    },
    instanceDetails: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '5px',
        fontSize: '0.8em',
    },
    lampStatus: {
        display: 'flex',
        gap: '10px',
        marginTop: '5px',
        gridColumn: '1 / -1',
    },
    amberLamp: {
        color: '#ff8c00',
        fontSize: '0.8em',
    },
    redLamp: {
        color: '#dc3545',
        fontSize: '0.8em',
    },
    protectLamp: {
        color: '#6f42c1',
        fontSize: '0.8em',
    },
};

// ENHANCED: Add hover effects for fault items
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        .fault-group-item:hover {
            background-color: #e3f2fd !important;
            border-color: #2196f3 !important;
            box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2) !important;
        }
    `;
    document.head.appendChild(styleSheet);
}

export default VehicleMap;