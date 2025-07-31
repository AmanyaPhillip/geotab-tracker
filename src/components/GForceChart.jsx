// GForceChart.jsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchAccelerometerData } from './vehicleUtils';

function GForceChart({ selectedTrip, sessionInfo, commonStyles }) {
    const [gForceData, setGForceData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        maxGForce: 0,
        minGForce: 0,
        avgGForce: 0,
        totalDataPoints: 0
    });

    useEffect(() => {
        if (selectedTrip && sessionInfo) {
            fetchGForceData();
        } else {
            setGForceData([]);
            setStats({
                maxGForce: 0,
                minGForce: 0,
                avgGForce: 0,
                totalDataPoints: 0
            });
        }
    }, [selectedTrip, sessionInfo]);

    const fetchGForceData = async () => {
        if (!selectedTrip || !sessionInfo) return;

        setIsLoading(true);
        setError(null);

        try {
            const accelerometerData = await fetchAccelerometerData(
                sessionInfo,
                selectedTrip.device.id,
                selectedTrip.start,
                selectedTrip.stop
            );

            if (accelerometerData.length === 0) {
                setError('No accelerometer data available for this trip');
                setGForceData([]);
                return;
            }

            // Process and convert to G-force
            const processedData = accelerometerData.map((reading, index) => {
                // Convert m/s² to G-force (divide by 9.81)
                const gForceX = reading.accelerationX / 9.81;
                const gForceY = reading.accelerationY / 9.81;
                const gForceZ = reading.accelerationZ / 9.81;
                
                // Calculate total G-force magnitude
                const totalGForce = Math.sqrt(gForceX * gForceX + gForceY * gForceY + gForceZ * gForceZ);
                
                return {
                    time: new Date(reading.dateTime).getTime(),
                    timeFormatted: new Date(reading.dateTime).toLocaleTimeString(),
                    gForceX: parseFloat(gForceX.toFixed(3)),
                    gForceY: parseFloat(gForceY.toFixed(3)),
                    gForceZ: parseFloat(gForceZ.toFixed(3)),
                    totalGForce: parseFloat(totalGForce.toFixed(3)),
                    index: index
                };
            });

            // Calculate statistics
            const gForceValues = processedData.map(d => d.totalGForce);
            const maxGForce = Math.max(...gForceValues);
            const minGForce = Math.min(...gForceValues);
            const avgGForce = gForceValues.reduce((sum, val) => sum + val, 0) / gForceValues.length;

            setStats({
                maxGForce: parseFloat(maxGForce.toFixed(3)),
                minGForce: parseFloat(minGForce.toFixed(3)),
                avgGForce: parseFloat(avgGForce.toFixed(3)),
                totalDataPoints: processedData.length
            });

            setGForceData(processedData);

        } catch (err) {
            console.error('Error fetching G-force data:', err);
            setError(`Failed to fetch accelerometer data: ${err.message}`);
            setGForceData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                        {`Time: ${data.timeFormatted}`}
                    </p>
                    <p style={{ margin: '0', color: '#8884d8' }}>
                        {`Total G-Force: ${data.totalGForce}g`}
                    </p>
                    <p style={{ margin: '0', color: '#82ca9d', fontSize: '0.9em' }}>
                        {`X: ${data.gForceX}g, Y: ${data.gForceY}g, Z: ${data.gForceZ}g`}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (!selectedTrip) {
        return null; // Don't render anything if no trip is selected
    }

    return (
        <div style={{
            ...commonStyles.form,
            marginTop: '20px',
            marginBottom: '20px'
        }}>
            <h2>G-Force Analysis</h2>
            
            {isLoading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p>Loading accelerometer data...</p>
                </div>
            )}

            {error && (
                <div style={{
                    ...commonStyles.error,
                    padding: '15px',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    marginBottom: '15px'
                }}>
                    <p><strong>Error:</strong> {error}</p>
                    <button
                        onClick={fetchGForceData}
                        style={{
                            ...commonStyles.button,
                            backgroundColor: '#dc3545',
                            marginTop: '10px'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {!isLoading && !error && gForceData.length > 0 && (
                <>
                    {/* Statistics Summary */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '10px',
                        marginBottom: '20px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#dc3545' }}>
                                {stats.maxGForce}g
                            </div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Max G-Force</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#28a745' }}>
                                {stats.minGForce}g
                            </div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Min G-Force</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#007bff' }}>
                                {stats.avgGForce}g
                            </div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Avg G-Force</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#6c757d' }}>
                                {stats.totalDataPoints}
                            </div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Data Points</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div style={{
                        width: '100%',
                        height: '400px',
                        marginBottom: '15px'
                    }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={gForceData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 60
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="index"
                                    type="number"
                                    scale="linear"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(value) => {
                                        const dataPoint = gForceData[Math.floor(value)];
                                        return dataPoint ? new Date(dataPoint.time).toLocaleTimeString() : '';
                                    }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                    fontSize={12}
                                />
                                <YAxis 
                                    label={{ value: 'G-Force (g)', angle: -90, position: 'insideLeft' }}
                                    fontSize={12}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="totalGForce" 
                                    stroke="#8884d8" 
                                    strokeWidth={2}
                                    dot={false}
                                    name="Total G-Force"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="gForceX" 
                                    stroke="#82ca9d" 
                                    strokeWidth={1}
                                    dot={false}
                                    name="X-Axis"
                                    strokeDasharray="5 5"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="gForceY" 
                                    stroke="#ffc658" 
                                    strokeWidth={1}
                                    dot={false}
                                    name="Y-Axis"
                                    strokeDasharray="5 5"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="gForceZ" 
                                    stroke="#ff7300" 
                                    strokeWidth={1}
                                    dot={false}
                                    name="Z-Axis"
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Trip Information */}
                    <div style={{
                        fontSize: '0.9em',
                        color: '#666',
                        textAlign: 'center',
                        padding: '10px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '4px'
                    }}>
                        <p style={{ margin: '0' }}>
                            Trip Duration: {new Date(selectedTrip.start).toLocaleString()} - {new Date(selectedTrip.stop).toLocaleString()}
                        </p>
                        <p style={{ margin: '5px 0 0 0' }}>
                            G-Force data shows vehicle acceleration in all three dimensions during the selected trip
                        </p>
                    </div>
                </>
            )}

            {!isLoading && !error && gForceData.length === 0 && selectedTrip && (
                <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #dee2e6'
                }}>
                    <p style={{ margin: '0 0 15px 0', fontSize: '1.1em', color: '#6c757d' }}>
                        No accelerometer data available for this trip
                    </p>
                    <p style={{ margin: '0', fontSize: '0.9em', color: '#6c757d' }}>
                        This vehicle may not have accelerometer sensors configured, or the data may not be available for the selected time period.
                    </p>
                    <button
                        onClick={fetchGForceData}
                        style={{
                            ...commonStyles.button,
                            backgroundColor: '#007bff',
                            marginTop: '15px'
                        }}
                    >
                        Retry Loading Data
                    </button>
                </div>
            )}
        </div>
    );
}

export default GForceChart;