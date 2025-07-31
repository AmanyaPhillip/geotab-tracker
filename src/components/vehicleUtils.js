// vehicleUtils.js
import axios from 'axios';

/**
 * Enhanced function to fetch fault codes with more detailed information.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<Array>} A promise that resolves to an array of grouped fault codes.
 */
export async function fetchFaultCodes(sessionInfo, deviceId) {
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

/**
 * Function to group faults by diagnostic name/code.
 * @param {Array} faults - Array of raw fault data.
 * @returns {Array} An array of grouped fault objects.
 */
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
export { groupFaultsByDiagnostic }; // Exporting for internal use or if needed elsewhere

/**
 * Calculates the distance between two points on the Earth (Haversine formula).
 * @param {object} latlon1 - First point { latitude, longitude }.
 * @param {object} latlon2 - Second point { latitude, longitude }.
 * @returns {number} Distance in meters.
 */
export function calculateDistance(latlon1, latlon2) {
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
 * @param {object} point - Point to check { longitude, latitude }.
 * @param {Array<Array<number>>} polygon - Array of polygon points [[latitude, longitude], ...].
 * @returns {boolean} True if point is inside, false otherwise.
 */
export function isPointInPolygon(point, polygon) {
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

/**
 * Fetches odometer data for a given device.
 * Tries multiple diagnostic IDs to find the latest odometer reading.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<number|null>} A promise that resolves to the latest odometer reading in meters, or null if not found.
 */
export async function fetchOdometer(sessionInfo, deviceId) {
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

/**
 * Fetches fuel consumption and level data for a given device.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<object>} A promise that resolves to an object containing total fuel, fuel level, and last updated time.
 */
export async function fetchFuelConsumption(sessionInfo, deviceId) {
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

/**
 * Calculates fuel efficiency over a specified period.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @param {number} hours - The period in hours for calculation (default 24).
 * @returns {Promise<object|null>} A promise that resolves to an object with efficiency, distance, fuelUsed, and period, or null if data is insufficient.
 */
export async function calculateFuelEfficiency(sessionInfo, deviceId, hours = 24) {
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

/**
 * Fetches accelerometer data for a given device and time period.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @param {string} fromDate - Start date in ISO format.
 * @param {string} toDate - End date in ISO format.
 * @returns {Promise<Array>} A promise that resolves to an array of accelerometer readings.
 */
export async function fetchAccelerometerData(sessionInfo, deviceId, fromDate, toDate) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;

    try {
        // Use MultiCall to fetch accelerometer data from multiple diagnostics simultaneously
        const response = await axios.post(apiUrl, {
            jsonrpc: '2.0',
            method: 'MultiCall',
            params: {
                calls: [
                    // X-axis (Forward/Reverse acceleration)
                    {
                        method: 'Get',
                        params: {
                            typeName: 'StatusData',
                            search: {
                                deviceSearch: { id: deviceId },
                                diagnosticSearch: { id: 'DiagnosticAccelerometerForwardGId' },
                                fromDate: fromDate,
                                toDate: toDate
                            }
                        }
                    },
                    // Y-axis (Left/Right acceleration) 
                    {
                        method: 'Get',
                        params: {
                            typeName: 'StatusData',
                            search: {
                                deviceSearch: { id: deviceId },
                                diagnosticSearch: { id: 'DiagnosticAccelerometerRightGId' },
                                fromDate: fromDate,
                                toDate: toDate
                            }
                        }
                    },
                    // Z-axis (Up/Down acceleration)
                    {
                        method: 'Get',
                        params: {
                            typeName: 'StatusData',
                            search: {
                                deviceSearch: { id: deviceId },
                                diagnosticSearch: { id: 'DiagnosticAccelerometerUpGId' },
                                fromDate: fromDate,
                                toDate: toDate
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
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 // 60 second timeout for potentially large datasets
        });

        const results = response.data.result;

        if (!results || results.length < 3) {
            console.warn('Incomplete accelerometer data received');
            return [];
        }

        const [xAxisData, yAxisData, zAxisData] = results;

        // If no data is available, try alternative diagnostic IDs
        if (!xAxisData.length && !yAxisData.length && !zAxisData.length) {
            return await fetchAccelerometerDataAlternative(sessionInfo, deviceId, fromDate, toDate);
        }

        // Combine the data from all three axes by timestamp
        const combinedData = combineAccelerometerData(xAxisData, yAxisData, zAxisData);

        return combinedData;

    } catch (err) {
        console.error('Error fetching accelerometer data:', err);
        
        // Try alternative method if primary fails
        try {
            return await fetchAccelerometerDataAlternative(sessionInfo, deviceId, fromDate, toDate);
        } catch (altErr) {
            console.error('Alternative accelerometer fetch also failed:', altErr);
            throw new Error(`Failed to fetch accelerometer data: ${err.message}`);
        }
    }
}

/**
 * Alternative method to fetch accelerometer data using different diagnostic IDs.
 * @param {object} sessionInfo - Geotab session information.
 * @param {string} deviceId - The ID of the device.
 * @param {string} fromDate - Start date in ISO format.
 * @param {string} toDate - End date in ISO format.
 * @returns {Promise<Array>} A promise that resolves to an array of accelerometer readings.
 */
async function fetchAccelerometerDataAlternative(sessionInfo, deviceId, fromDate, toDate) {
    const apiUrl = `https://${sessionInfo.server}/apiv1/`;

    const alternativeDiagnostics = [
        'DiagnosticAccelerometerReverseGId',
        'DiagnosticAccelerometerLeftGId', 
        'DiagnosticAccelerometerDownGId',
        // Generic accelerometer diagnostics
        'DiagnosticAccelerationForwardBrakingId',
        'DiagnosticAccelerationSidewaysLeftId',
        'DiagnosticAccelerationSidewaysRightId'
    ];

    try {
        const response = await axios.post(apiUrl, {
            jsonrpc: '2.0',
            method: 'MultiCall',
            params: {
                calls: alternativeDiagnostics.map(diagId => ({
                    method: 'Get',
                    params: {
                        typeName: 'StatusData',
                        search: {
                            deviceSearch: { id: deviceId },
                            diagnosticSearch: { id: diagId },
                            fromDate: fromDate,
                            toDate: toDate
                        }
                    }
                })),
                credentials: {
                    database: sessionInfo.database,
                    userName: sessionInfo.userName,
                    sessionId: sessionInfo.sessionId,
                }
            },
            id: Math.floor(Math.random() * 10000),
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });

        const results = response.data.result;
        
        if (!results || results.length === 0) {
            return [];
        }

        // Find the diagnostic with the most data
        const bestResult = results.reduce((best, current) => 
            current.length > best.length ? current : best, results[0] || []);

        // Convert single-axis data to three-axis format
        return bestResult.map(reading => ({
            dateTime: reading.dateTime,
            accelerationX: reading.data || 0, // Use available data as X-axis
            accelerationY: 0, // Default other axes to 0
            accelerationZ: 0
        }));

    } catch (err) {
        console.error('Alternative accelerometer fetch failed:', err);
        return [];
    }
}

/**
 * Combines accelerometer data from three axes into a single dataset.
 * @param {Array} xAxisData - X-axis acceleration data.
 * @param {Array} yAxisData - Y-axis acceleration data.
 * @param {Array} zAxisData - Z-axis acceleration data.
 * @returns {Array} Combined accelerometer data.
 */
function combineAccelerometerData(xAxisData, yAxisData, zAxisData) {
    // Create a map to store readings by timestamp
    const readingsMap = new Map();

    // Process X-axis data
    xAxisData.forEach(reading => {
        const timestamp = reading.dateTime;
        if (!readingsMap.has(timestamp)) {
            readingsMap.set(timestamp, {
                dateTime: timestamp,
                accelerationX: 0,
                accelerationY: 0,
                accelerationZ: 0
            });
        }
        readingsMap.get(timestamp).accelerationX = reading.data || 0;
    });

    // Process Y-axis data
    yAxisData.forEach(reading => {
        const timestamp = reading.dateTime;
        if (!readingsMap.has(timestamp)) {
            readingsMap.set(timestamp, {
                dateTime: timestamp,
                accelerationX: 0,
                accelerationY: 0,
                accelerationZ: 0
            });
        }
        readingsMap.get(timestamp).accelerationY = reading.data || 0;
    });

    // Process Z-axis data
    zAxisData.forEach(reading => {
        const timestamp = reading.dateTime;
        if (!readingsMap.has(timestamp)) {
            readingsMap.set(timestamp, {
                dateTime: timestamp,
                accelerationX: 0,
                accelerationY: 0,
                accelerationZ: 0
            });
        }
        readingsMap.get(timestamp).accelerationZ = reading.data || 0;
    });

    // Convert map to array and sort by timestamp
    const combinedData = Array.from(readingsMap.values())
        .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    return combinedData;
}