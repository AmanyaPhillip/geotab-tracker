import React from 'react';

function NavBar({ vehicles, selectedVehicleId, onVehicleChange, onLogout }) {
    return (
        <nav style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            background: '#007bff',
            color: '#fff',
            marginBottom: '20px',
            borderRadius: '8px'
        }}>
            <div>
                <label htmlFor="vehicle-select" style={{ marginRight: 8 }}>Select Vehicle:</label>
                <select
                    id="vehicle-select"
                    value={selectedVehicleId}
                    onChange={e => onVehicleChange(e.target.value)}
                    style={{ padding: '6px', borderRadius: '4px', border: 'none' }}
                >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map(vehicle => (
                        <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                    ))}
                </select>
            </div>
            <button
                onClick={onLogout}
                style={{
                    background: '#fff',
                    color: '#007bff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Logout
            </button>
        </nav>
    );
}

export default NavBar;