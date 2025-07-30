import React, { useState } from 'react';

function AuthForm({ onLogin, isLoading, error }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [database, setDatabase] = useState('');
    const [server, setServer] = useState(''); // New state for server URL

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin({ username, password, database, server }); // Pass server to onLogin
    };

    return (
        // The outermost div no longer needs the full 'container' style.
        // It will inherit from App.jsx's container.
        // We'll apply the 'form' style directly here.
        <form onSubmit={handleSubmit} style={styles.form}> {/* <<< MODIFIED */}
            <h2>Login to Geotab</h2>
            <div style={styles.inputGroup}>
                <label htmlFor="server" style={styles.label}>Server (e.g., my.geotab.com)</label>
                <input
                    type="text"
                    id="server"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    required
                    style={styles.input}
                />
            </div>
            <div style={styles.inputGroup}>
                <label htmlFor="database" style={styles.label}>Database Name</label>
                <input
                    type="text"
                    id="database"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    required
                    style={styles.input}
                />
            </div>
            <div style={styles.inputGroup}>
                <label htmlFor="username" style={styles.label}>Username</label>
                <input
                    type="email"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={styles.input}
                />
            </div>
            <div style={styles.inputGroup}>
                <label htmlFor="password" style={styles.label}>Password</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.input}
                />
            </div>
            <button type="submit" disabled={isLoading} style={{ ...styles.button, ...(isLoading && styles.buttonDisabled) }}>
                {isLoading ? 'Logging In...' : 'Login'}
            </button>
            {error && <p style={styles.error}>{error}</p>}
        </form>
    );
}

// Keep only the form-specific styles here
const styles = {
    form: {
        backgroundColor: '#fff',
        color: '#213547',
        padding: '2vw',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '400px',
        minWidth: '260px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
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
    '@media (min-width: 600px)': {
        form: {
            maxWidth: '500px',
            padding: '2.5vw',
        },
    },
};

export default AuthForm;