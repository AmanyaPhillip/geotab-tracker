import React, { useEffect, useState } from 'react';
import axios from 'axios';

function PastTripsCard({ selectedVehicleId, sessionInfo, onTripSelect, commonStyles }) {
    const [trips, setTrips] = useState([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const [tripsError, setTripsError] = useState(null);
    const [selectedTripId, setSelectedTripId] = useState('');
    const [tripInfo, setTripInfo] = useState(null);

    useEffect(() => {
        if (!selectedVehicleId || !sessionInfo) {
            setTrips([]);
            setTripInfo(null);
            return;
        }

        const fetchTrips = async () => {
            setIsLoadingTrips(true);
            setTripsError(null);

            const apiUrl = `https://${sessionInfo.server}/apiv1/`;

            try {
                // Replace 'Trip' with the correct Geotab API typeName for trips/history
                const response = await axios.post(apiUrl, {
                    jsonrpc: '2.0',
                    method: 'Get',
                    params: {
                        typeName: 'Trip',
                        search: {
                            deviceSearch: { id: selectedVehicleId }
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
                console.log('Trip API result:', result); // Add this line
                if (result) {
                    setTrips(result);
                } else if (response.data.error) {
                    setTripsError(response.data.error.message || 'Failed to fetch trips.');
                } else {
                    setTripsError('Failed to fetch trips: Unexpected API response.');
                }
            } catch (err) {
                setTripsError('Could not fetch trips. Please try again.');
            } finally {
                setIsLoadingTrips(false);
            }
        };

        fetchTrips();
    }, [selectedVehicleId, sessionInfo]);

    const handleTripChange = (e) => {
        const tripId = e.target.value;
        setSelectedTripId(tripId);
        const trip = trips.find(t => t.id === tripId);
        setTripInfo(trip || null);
        if (trip && onTripSelect) {
            onTripSelect(trip);
        }
    };

    function formatTripDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ; ${hours}h:${minutes}m`;
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
                        <option value="">-- Select Trip --</option>
                        {trips.map(trip => (
                            <option key={trip.id} value={trip.id}>
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
                </div>
            )}
        </div>
    );
}

export default PastTripsCard;