// MapComponents.jsx
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import myMarkerIcon from '../assets/my-marker.png'; // Adjust path if necessary

// Fix for default Leaflet marker icons not showing up with Webpack/Vite
delete L.Icon.Default.prototype._get;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom marker icon
export const customIcon = L.icon({
    iconUrl: myMarkerIcon,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50],
});

// MapUpdater component
export function MapUpdater({ center, polylinePositions }) {
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

// Fault Detail Modal Component
export function FaultDetailModal({ faultGroup, onClose }) {
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
                                <div key={instance.id || index} style={styles.instanceItem}>
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


export const styles = {
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
        alignItems: 'stretch',
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
        display: 'flex',
        flexDirection: 'column',
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
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        border: '1px solid #e9ecef',
    },
    faultCodesContent: {
        flex: 1,
        overflowY: 'auto',
        maxHeight: 'none',
    },
    faultCodesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
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

// Add hover effects for fault items
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