// ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error details
        console.error('ErrorBoundary caught an error:', error);
        console.error('Error info:', errorInfo);
        
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // You can also log the error to an error reporting service here
        // For example: logErrorToService(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ 
            hasError: false, 
            error: null, 
            errorInfo: null 
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom error UI
            return (
                <div style={errorStyles.container}>
                    <div style={errorStyles.errorBox}>
                        <h2 style={errorStyles.title}>⚠️ Something went wrong</h2>
                        <p style={errorStyles.message}>
                            {this.props.fallbackMessage || 
                             "An unexpected error occurred. Please try refreshing the page or contact support if the problem persists."}
                        </p>
                        
                        {this.props.showDetails && this.state.error && (
                            <details style={errorStyles.details}>
                                <summary style={errorStyles.summary}>Error Details</summary>
                                <div style={errorStyles.errorDetails}>
                                    <strong>Error:</strong> {this.state.error.toString()}
                                    <br />
                                    <strong>Component Stack:</strong>
                                    <pre style={errorStyles.stack}>
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}
                        
                        <div style={errorStyles.actions}>
                            <button 
                                onClick={this.handleRetry}
                                style={errorStyles.retryButton}
                            >
                                Try Again
                            </button>
                            <button 
                                onClick={() => window.location.reload()}
                                style={errorStyles.refreshButton}
                            >
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const errorStyles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
    },
    errorBox: {
        backgroundColor: '#fff',
        border: '2px solid #dc3545',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    },
    title: {
        color: '#dc3545',
        marginBottom: '15px',
        fontSize: '1.5em',
    },
    message: {
        color: '#666',
        marginBottom: '20px',
        lineHeight: '1.5',
    },
    details: {
        marginTop: '20px',
        textAlign: 'left',
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
    },
    summary: {
        cursor: 'pointer',
        fontWeight: 'bold',
        color: '#495057',
        marginBottom: '10px',
    },
    errorDetails: {
        fontSize: '0.9em',
        color: '#6c757d',
    },
    stack: {
        backgroundColor: '#343a40',
        color: '#fff',
        padding: '10px',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '0.8em',
        marginTop: '10px',
    },
    actions: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '20px',
    },
    retryButton: {
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '10px 20px',
        cursor: 'pointer',
        fontSize: '1em',
        fontWeight: 'bold',
    },
    refreshButton: {
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '10px 20px',
        cursor: 'pointer',
        fontSize: '1em',
        fontWeight: 'bold',
    },
};

export default ErrorBoundary;