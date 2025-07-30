// PastTripsCard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

function PastTripsCard({ selectedVehicleId, sessionInfo, onTripSelect, commonStyles }) {
    const [trips, setTrips] = useState([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const [tripsError, setTripsError] = useState(null);
    const [selectedTripId, setSelectedTripId] = useState('');
    const [tripInfo, setTripInfo] = useState(null); // This will now hold the full trip data including path

    // Effect to fetch available trips for the selected vehicle
    useEffect(() => {
        if (!selectedVehicleId || !sessionInfo) {
            setTrips([]);
            setTripInfo(null);
            setSelectedTripId(''); // Reset selected trip
            return;
        }

        const fetchTrips = async () => {
            setIsLoadingTrips(true);
            setTripsError(null);

            const apiUrl = `https://${sessionInfo.server}/apiv1/`;

            try {
                // Fetch summary 'Trip' objects
                const response = await axios.post(apiUrl, {
                    jsonrpc: '2.0',
                    method: 'Get',
                    params: {
                        typeName: 'Trip',
                        search: {
                            deviceSearch: { id: selectedVehicleId },
                            // Optionally, add a date range here to limit the number of trips fetched initially
                            // For example, for the last 30 days:
                            // fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                            // toDate: new Date().toISOString()
                        },
                        credentials: {
                            database: sessionInfo.database,
                            userName: sessionInfo.userName,
                            sessionId: sessionInfo.sessionId,
                        },
                    },
                    id: 5,
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = response.data.result;
                // --- NEW CONSOLE LOG START ---
                console.log('Trip API result (summaries):', result);
                // --- NEW CONSOLE LOG END ---
                if (result) {
                    setTrips(result);
                } else if (response.data.error) {
                    setTripsError(response.data.error.message || 'Failed to fetch trips.');
                } else {
                    setTripsError('Failed to fetch trips: Unexpected API response.');
                }
            } catch (err) {
                console.error('Error fetching trips:', err);
                setTripsError('Could not fetch trips. Please try again.');
            } finally {
                setIsLoadingTrips(false);
            }
        };

        fetchTrips();
    }, [selectedVehicleId, sessionInfo]);

    // Function to fetch detailed LogRecords for a specific trip
    const fetchTripLogRecords = async (trip) => {
        if (!trip || !trip.device || !trip.device.id || !trip.start || !trip.stop || !sessionInfo) {
            console.warn("Invalid trip or session info for fetching log records.", trip, sessionInfo);
            return [];
        }

        const apiUrl = `https://${sessionInfo.server}/apiv1/`;

        try {
            setIsLoadingTrips(true); // Indicate loading while fetching log records
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Get',
                params: {
                    typeName: 'LogRecord',
                    search: {
                        deviceSearch: { id: trip.device.id },
                        fromDate: trip.start,
                        toDate: trip.stop
                    },
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: 6, // Unique ID for this request
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const result = response.data.result;
            // --- NEW CONSOLE LOGS START ---
            console.log('LogRecord API raw result for trip:', trip.id, result); // This logs the raw array of log records
            // --- NEW CONSOLE LOGS END ---
            if (result) {
                // Filter out invalid points and map to [latitude, longitude] format
                const path = result
                    .filter(log => typeof log.latitude === 'number' && typeof log.longitude === 'number')
                    .map(log => [log.latitude, log.longitude]);
                // --- NEW CONSOLE LOGS START ---
                console.log('Processed trip path for trip:', trip.id, path); // This logs the final array of [lat, lng] pairs
                // --- NEW CONSOLE LOGS END ---
                return path;
            } else if (response.data.error) {
                console.error('Geotab API Error fetching log records:', response.data.error);
                setTripsError(response.data.error.message || 'Failed to fetch trip details.');
                return [];
            }
            return [];
        } catch (err) {
            console.error('Network or Request Error fetching log records:', err);
            setTripsError('Could not fetch trip details. Please try again.');
            return [];
        } finally {
            setIsLoadingTrips(false);
        }
    };

    // Handle when a trip is selected from the dropdown
    const handleTripChange = async (e) => {
        const tripId = e.target.value;
        setSelectedTripId(tripId);

        if (tripId === "") {
            setTripInfo(null);
            if (onTripSelect) {
                onTripSelect(null); // Clear selected trip in parent
            }
            return;
        }

        const selectedTripSummary = trips.find(t => t.id === tripId);

        if (selectedTripSummary) {
            // Fetch detailed log records for the selected trip
            const tripPath = await fetchTripLogRecords(selectedTripSummary);
            
            // Combine summary info with the fetched path
            const fullTripData = { ...selectedTripSummary, path: tripPath };
            setTripInfo(fullTripData); // Update local state for display

            if (onTripSelect) {
                onTripSelect(fullTripData); // Pass the full trip data (with path) to the parent
            }
        } else {
            setTripInfo(null);
            if (onTripSelect) {
                onTripSelect(null);
            }
        }
    };

    function formatTripDate(dateStr) {
    
        return new Date(dateStr).toLocaleString();
    }

    return (
        <div style={commonStyles.form}>
            <h2>Past Trips</h2>
            {isLoadingTrips && <p>Loading trips...</p>}
            {tripsError && <p style={commonStyles.error}>Error: {tripsError}</p>}
            {!isLoadingTrips && !tripsError && trips.length > 0 && (
                <div style={commonStyles.inputGroup}>
                    <label htmlFor="trip-select" style={commonStyles.label}>Choose a trip:</label>
                    <select
                        id="trip-select"
                        value={selectedTripId}
                        onChange={handleTripChange}
                        style={commonStyles.input}
                    >
                        <option value="" style={{textAlign : 'center'}}>-- Select Trip --</option>
                        {trips.map(trip => (
                            <option key={trip.id} value={trip.id} style={{textAlign : 'center'}}>
                                {formatTripDate(trip.start)} - {formatTripDate(trip.stop)}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {!isLoadingTrips && !tripsError && trips.length === 0 && (
                <p>No trips found for this vehicle.</p>
            )}
            {tripInfo && (
                <div style={{ marginTop: '1em', background: '#f8f9fa', padding: '1em', borderRadius: '8px' }}>
                    <p><strong>Average Speed:</strong> {tripInfo.averageSpeed ? tripInfo.averageSpeed.toFixed(1) : 'N/A'} km/h</p>
                    <p><strong>Distance Traveled:</strong> {tripInfo.distance ? (tripInfo.distance / 1000).toFixed(2) : 'N/A'} km</p>
                    <p><strong>Fuel Consumption:</strong> {tripInfo.fuelUsed ? tripInfo.fuelUsed.toFixed(2) : 'N/A'} L</p>
                    {tripInfo.path && tripInfo.path.length > 0 && (
                        <p><strong>Path Points:</strong> {tripInfo.path.length} points</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default PastTripsCard;