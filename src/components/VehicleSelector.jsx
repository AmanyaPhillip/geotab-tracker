import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Receive commonStyles as a prop
function VehicleSelector({ sessionInfo, onVehicleSelect, commonStyles }) { 
    const [vehicles, setVehicles] = useState([]);
    const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
    const [vehiclesError, setVehiclesError] = useState(null);
    const [currentSelectedId, setCurrentSelectedId] = useState(''); // To control the select element

    useEffect(() => {
        const fetchVehicles = async () => {
            setIsLoadingVehicles(true);
            setVehiclesError(null);

            if (!sessionInfo || !sessionInfo.sessionId) {
                setVehiclesError('Authentication session not found.');
                setIsLoadingVehicles(false);
                return;
            }

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
                    id: 2, // A unique ID for this request
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = response.data.result;

                if (result) {
                    setVehicles(result);
                    // Only pre-select if nothing is selected yet
                    if (result.length > 0 && !currentSelectedId) {
                        setCurrentSelectedId(result[0].id);
                        onVehicleSelect(result[0].id);
                    }
                } else if (response.data.error) {
                    setVehiclesError(response.data.error.message || 'Failed to fetch vehicles.');
                    console.error('Geotab API Error fetching devices:', response.data.error);
                } else {
                    setVehiclesError('Failed to fetch vehicles: Unexpected API response.');
                    console.error('Unexpected API response fetching devices:', response.data);
                }

            } catch (err) {
                console.error('Network or Request Error fetching devices:', err);
                setVehiclesError('Could not fetch vehicles. Please try again.');
            } finally {
                setIsLoadingVehicles(false);
            }
        };

        fetchVehicles();
    }, [sessionInfo, onVehicleSelect]); // Re-run when sessionInfo changes

    const handleSelectChange = (e) => {
        const selectedId = e.target.value;
        setCurrentSelectedId(selectedId);
        onVehicleSelect(selectedId); // Notify parent component
    };

    return (
        // Apply the common form style to the container div
        <div style={commonStyles.form}> {/* <<< MODIFIED */}
            <h2>Select a Vehicle</h2>
            {isLoadingVehicles && <p>Loading vehicles...</p>}
            {vehiclesError && <p style={commonStyles.error}>Error: {vehiclesError}</p>}
            
            {!isLoadingVehicles && !vehiclesError && vehicles.length > 0 && (
                <div style={commonStyles.inputGroup}> {/* Use inputGroup style */}
                    <label htmlFor="vehicle-select" style={commonStyles.label}>Choose a vehicle:</label>
                    <select
                        id="vehicle-select"
                        value={currentSelectedId}
                        onChange={handleSelectChange}
                        style={{...commonStyles.input, width: 'fit-content', textAlign: 'center'}}
                    >
                        {vehicles.map(vehicle => (
                            <option key={vehicle.id} value={vehicle.id}style={{textAlign:'center'}}>
                                {vehicle.name || vehicle.id}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {!isLoadingVehicles && !vehiclesError && vehicles.length === 0 && (
                <p>No vehicles found in this database.</p>
            )}
        </div>
    );
}

export default VehicleSelector;