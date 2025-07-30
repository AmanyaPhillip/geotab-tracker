import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function VehicleSelector({ sessionInfo, onVehicleSelect, commonStyles }) {
    const [vehicles, setVehicles] = useState([]);
    const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
    const [vehiclesError, setVehiclesError] = useState(null);
    const [currentSelectedId, setCurrentSelectedId] = useState('');

    // Memoize the fetch function to prevent unnecessary re-renders
    const fetchVehicles = useCallback(async () => {
        if (!sessionInfo?.sessionId) {
            setVehiclesError('Authentication session not found.');
            setIsLoadingVehicles(false);
            return;
        }

        setIsLoadingVehicles(true);
        setVehiclesError(null);

        const apiUrl = `https://${sessionInfo.server}/apiv1/`;

        try {
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Get',
                params: {
                    typeName: 'Device',
                    credentials: {
                        database: sessionInfo.database,
                        userName: sessionInfo.userName,
                        sessionId: sessionInfo.sessionId,
                    },
                },
                id: 2,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (!response || !response.data) {
                throw new Error('Invalid response from server');
            }

            const result = response.data.result;

            if (result && Array.isArray(result)) {
                setVehicles(result);
                // Only pre-select if nothing is selected yet and we have vehicles
                if (result.length > 0 && !currentSelectedId) {
                    const firstVehicleId = result[0].id;
                    setCurrentSelectedId(firstVehicleId);
                    if (onVehicleSelect) {
                        onVehicleSelect(firstVehicleId);
                    }
                }
            } else if (response.data.error) {
                const errorMessage = response.data.error.message || 'Failed to fetch vehicles.';
                setVehiclesError(errorMessage);
                console.error('Geotab API Error fetching devices:', response.data.error);
            } else {
                setVehiclesError('Failed to fetch vehicles: Unexpected API response.');
                console.error('Unexpected API response fetching devices:', response.data);
            }

        } catch (err) {
            console.error('Network or Request Error fetching devices:', err);
            
            let errorMessage = 'Could not fetch vehicles. Please try again.';
            
            if (err.response) {
                errorMessage = `Server error (${err.response.status}): ${err.response.statusText || 'Unknown error'}`;
            } else if (err.request) {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (err.code === 'ECONNABORTED') {
                errorMessage = 'Request timed out. Please try again.';
            } else if (err.message) {
                errorMessage = `Error: ${err.message}`;
            }
            
            setVehiclesError(errorMessage);
        } finally {
            setIsLoadingVehicles(false);
        }
    }, [sessionInfo, currentSelectedId, onVehicleSelect]);

    useEffect(() => {
        if (sessionInfo) {
            fetchVehicles();
        } else {
            // Reset state when session is cleared
            setVehicles([]);
            setCurrentSelectedId('');
            setVehiclesError(null);
            setIsLoadingVehicles(false);
        }
    }, [sessionInfo, fetchVehicles]);

    const handleSelectChange = useCallback((e) => {
        try {
            const selectedId = e.target.value;
            setCurrentSelectedId(selectedId);
            
            if (onVehicleSelect) {
                onVehicleSelect(selectedId);
            }
        } catch (err) {
            console.error('Error handling vehicle selection:', err);
            setVehiclesError('Error selecting vehicle. Please try again.');
        }
    }, [onVehicleSelect]);

    const handleRetry = useCallback(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    // Render loading state
    if (isLoadingVehicles) {
        return (
            <div style={commonStyles?.form || {}}>
                <h2>Select a Vehicle</h2>
                <p>Loading vehicles...</p>
            </div>
        );
    }

    // Render error state with retry option
    if (vehiclesError) {
        return (
            <div style={commonStyles?.form || {}}>
                <h2>Select a Vehicle</h2>
                <p style={commonStyles?.error || { color: 'red' }}>
                    Error: {vehiclesError}
                </p>
                <button
                    onClick={handleRetry}
                    style={{
                        ...commonStyles?.button,
                        backgroundColor: '#28a745',
                        marginTop: '10px'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    // Render empty state
    if (!vehicles || vehicles.length === 0) {
        return (
            <div style={commonStyles?.form || {}}>
                <h2>Select a Vehicle</h2>
                <p>No vehicles found in this database.</p>
                <button
                    onClick={handleRetry}
                    style={{
                        ...commonStyles?.button,
                        backgroundColor: '#007bff',
                        marginTop: '10px'
                    }}
                >
                    Refresh
                </button>
            </div>
        );
    }

    // Render normal state with vehicles
    return (
        <div style={commonStyles?.form || {}}>
            <h2>Select a Vehicle</h2>
            <div style={commonStyles?.inputGroup || {}}>
                <label 
                    htmlFor="vehicle-select" 
                    style={commonStyles?.label || {}}
                >
                    Choose a vehicle:
                </label>
                <select
                    id="vehicle-select"
                    value={currentSelectedId}
                    onChange={handleSelectChange}
                    style={{
                        ...commonStyles?.input,
                        width: 'fit-content',
                        textAlign: 'center'
                    }}
                >
                    {vehicles.map(vehicle => {
                        // Safely access vehicle properties
                        const vehicleId = vehicle?.id || 'unknown';
                        const vehicleName = vehicle?.name || vehicleId;
                        
                        return (
                            <option 
                                key={vehicleId} 
                                value={vehicleId}
                                style={{ textAlign: 'center' }}
                            >
                                {vehicleName}
                            </option>
                        );
                    })}
                </select>
            </div>
            <button
                onClick={handleRetry}
                style={{
                    ...commonStyles?.button,
                    backgroundColor: '#17a2b8',
                    fontSize: '0.9em',
                    padding: '0.5em 1em'
                }}
            >
                Refresh Vehicles
            </button>
        </div>
    );
}

export default VehicleSelector;