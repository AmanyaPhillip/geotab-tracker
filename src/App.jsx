import React, { useState } from 'react';
import AuthForm from './components/AuthForm';
import VehicleMap from './components/VehicleMap';
import PastTripsCard from './components/PastTripsCard';
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary
import axios from 'axios';
import './App.css'; 
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);

    const handleLogin = async ({ username, password, database, server }) => {
        setIsLoading(true);
        setError(null);

        const apiUrl = `https://${server}/apiv1/`;

        try {
            const response = await axios.post(apiUrl, {
                jsonrpc: '2.0',
                method: 'Authenticate',
                params: {
                    userName: username,
                    password: password,
                    database: database,
                },
                id: 1,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = response.data.result;

            if (result && result.credentials && result.credentials.sessionId) {
                setSessionInfo({
                    database: result.credentials.database,
                    userName: result.credentials.userName,
                    sessionId: result.credentials.sessionId,
                    server: server
                });
                setIsAuthenticated(true);
                console.log('Login successful');
            } else if (response.data.error) {
                setError(response.data.error.message || 'Authentication failed.');
                console.error('Geotab API Error:', response.data.error);
            } else {
                setError('Authentication failed: Unexpected API response.');
                console.error('Unexpected API response:', response.data);
            }

        } catch (err) {
            console.error('Network or Request Error:', err);
            if (err.response) {
                setError(`Login failed: Server responded with status ${err.response.status}. Please check server URL and credentials.`);
            } else if (err.request) {
                setError('Login failed: No response from server. Check your internet connection or server address.');
            } else {
                setError(`Login failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVehicleSelected = (vehicleId) => {
        // Reset selected trip when vehicle changes
        if (vehicleId !== selectedVehicleId) {
            setSelectedTrip(null);
        }
        setSelectedVehicleId(vehicleId);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setSessionInfo(null);
        setSelectedVehicleId(null);
        setSelectedTrip(null);
    };

    return (
        <ErrorBoundary 
            fallbackMessage="Something went wrong with the application. Please refresh the page or try logging in again."
            showDetails={true}
        >
            <div style={appStyles.container}>
                {!isAuthenticated ? (
                    <ErrorBoundary 
                        fallbackMessage="There was an issue with the login form. Please refresh the page and try again."
                        showDetails={false}
                    >
                        <AuthForm onLogin={handleLogin} isLoading={isLoading} error={error} />
                    </ErrorBoundary>
                ) : (
                    <div style={appStyles.authenticatedContent}>
                        <h1>Welcome, {sessionInfo.userName}!</h1>
                        <p>Logged into database: {sessionInfo.database}</p>

                        {/* Wrap VehicleMap in ErrorBoundary */}
                        <ErrorBoundary 
                            fallbackMessage="There was an issue loading the vehicle map. Please try refreshing or selecting a different vehicle."
                            showDetails={false}
                        >
                            <VehicleMap 
                                sessionInfo={sessionInfo} 
                                onVehicleSelect={handleVehicleSelected}
                                selectedVehicleId={selectedVehicleId}
                                commonStyles={{ 
                                    form: { ...appStyles.form, marginTop: '20px', maxWidth: '700px' },
                                    error: appStyles.error,
                                    inputGroup: appStyles.inputGroup,
                                    label: appStyles.label,
                                    input: appStyles.input,
                                    button: appStyles.button,
                                }}
                                selectedTrip={selectedTrip}
                            />
                        </ErrorBoundary>

                        {/* Wrap PastTripsCard in ErrorBoundary */}
                        {selectedVehicleId && (
                            <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'stretch' }}>
                                <ErrorBoundary 
                                    fallbackMessage="There was an issue loading the past trips. Please try selecting the vehicle again or refresh the page."
                                    showDetails={false}
                                >
                                    <PastTripsCard
                                        selectedVehicleId={selectedVehicleId}
                                        sessionInfo={sessionInfo}
                                        onTripSelect={setSelectedTrip}
                                        commonStyles={{
                                            ...appStyles,
                                            form: { ...appStyles.form, width: '100%', maxWidth: '100%' },
                                        }}
                                    />
                                </ErrorBoundary>
                            </div>
                        )}

                        {/* Logout button */}
                        <button 
                            onClick={handleLogout}
                            style={appStyles.logoutButton}
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
}

// Define styles directly in App.jsx or move to a separate styles file
const appStyles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        minWidth: '100vw',
        background: 'linear-gradient(135deg, #213547 0%, #646cff 100%)',
        fontFamily: 'Arial, sans-serif',
        padding: '2vw',
    },
    authenticatedContent: {
        backgroundColor: '#fff',
        color: '#213547',
        padding: '2vw',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        width: 'fit-content',
        maxWidth: '90vw',
        minWidth: '260px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxHeight: '90vh',
        overflowY: 'auto',
    },
    logoutButton: {
        padding: '0.7em 1em',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1em',
        marginTop: '1em',
        fontWeight: 'bold',
    },
    selectedVehicleInfo: {
        marginTop: '20px',
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        width: '80%',
        textAlign: 'center',
    },
    form: {
        backgroundColor: '#fff',
        color: '#213547',
        padding: '2vw',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
        width: '100%',
        maxWidth: '400px',
        minWidth: '260px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        marginTop: '20px',
    },
    inputGroup: {
        marginBottom: '1.2em',
    },
    label: {
        display: 'block',
        marginBottom: '0.5em',
        fontWeight: 'bold',
        color: '#213547',
    },
    input: {
        width: '100%',
        padding: '0.7em',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxSizing: 'border-box',
        fontSize: '1em',
    },
    button: {
        width: '100%',
        padding: '0.7em 1em',
        backgroundColor: '#646cff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1em',
        marginTop: '1em',
        fontWeight: 'bold',
    },
    buttonDisabled: {
        backgroundColor: '#cccccc',
        cursor: 'not-allowed',
    },
    error: {
        color: 'red',
        marginTop: '1em',
        textAlign: 'center',
    },
};

export default App;