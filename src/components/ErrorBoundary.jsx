import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null,
            eventId: null
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Generate a unique ID for this error event
        const eventId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log the error details
        console.error(`[${eventId}] ErrorBoundary caught an error:`, error);
        console.error(`[${eventId}] Error info:`, errorInfo);
        
        this.setState({
            error: error,
            errorInfo: errorInfo,
            eventId: eventId
        });

        // In a production environment, you might want to send this to an error reporting service
        this.logErrorToService(error, errorInfo, eventId);
    }

    logErrorToService = (error, errorInfo, eventId) => {
        // This is where you would send error data to your error tracking service
        // For example: Sentry, LogRocket, Rollbar, etc.
        
        const errorData = {
            eventId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            componentStack: errorInfo.componentStack,
            props: this.props.context ? { context: this.props.context } : {}
        };

        // Example: Send to your logging service
        // fetch('/api/log-error', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(errorData)
        // }).catch(err => console.error('Failed to log error:', err));

        // For now, just log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.warn('Error logged (would be sent to service in production):', errorData);
        }
    };

    handleRetry = () => {
        this.setState({ 
            hasError: false, 
            error: null, 
            errorInfo: null,
            eventId: null
        });
    };

    handleReportError = () => {
        const { eventId, error, errorInfo } = this.state;
        const subject = encodeURIComponent(`Error Report - ${eventId}`);
        const body = encodeURIComponent(`
Error ID: ${eventId}
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.message || 'Unknown error'}

Component Stack:
${errorInfo?.componentStack || 'Not available'}

Error Stack:
${error?.stack || 'Not available'}

Please describe what you were doing when this error occurred:
[Your description here]
        `);
        
        // You can change this to your support email
        window.open(`mailto:support@yourcompany.com?subject=${subject}&body=${body}`);
    };

    render() {
        if (this.state.hasError) {
            const { error, errorInfo, eventId } = this.state;
            const { fallbackMessage, showDetails = false, allowRetry = true, showReportButton = true } = this.props;

            return (
                <div style={errorStyles.container}>
                    <div style={errorStyles.errorBox}>
                        <h2 style={errorStyles.title}>⚠️ Something went wrong</h2>
                        
                        <p style={errorStyles.message}>
                            {fallbackMessage || 
                             "An unexpected error occurred. Please try refreshing the page or contact support if the problem persists."}
                        </p>

                        {eventId && (
                            <p style={errorStyles.eventId}>
                                <strong>Error ID:</strong> {eventId}
                            </p>
                        )}
                        
                        {showDetails && error && (
                            <details style={errorStyles.details}>
                                <summary style={errorStyles.summary}>Technical Details</summary>
                                <div style={errorStyles.errorDetails}>
                                    <div style={errorStyles.errorSection}>
                                        <strong>Error:</strong> {error.toString()}
                                    </div>
                                    
                                    {error.stack && (
                                        <div style={errorStyles.errorSection}>
                                            <strong>Stack Trace:</strong>
                                            <pre style={errorStyles.stack}>
                                                {error.stack}
                                            </pre>
                                        </div>
                                    )}
                                    
                                    {errorInfo?.componentStack && (
                                        <div style={errorStyles.errorSection}>
                                            <strong>Component Stack:</strong>
                                            <pre style={errorStyles.stack}>
                                                {errorInfo.componentStack}
                                            </pre>
                                        </div>
                                    )}

                                    <div style={errorStyles.errorSection}>
                                        <strong>Browser:</strong> {navigator.userAgent}
                                    </div>
                                    
                                    <div style={errorStyles.errorSection}>
                                        <strong>URL:</strong> {window.location.href}
                                    </div>
                                    
                                    <div style={errorStyles.errorSection}>
                                        <strong>Time:</strong> {new Date().toISOString()}
                                    </div>
                                </div>
                            </details>
                        )}
                        
                        <div style={errorStyles.actions}>
                            {allowRetry && (
                                <button 
                                    onClick={this.handleRetry}
                                    style={errorStyles.retryButton}
                                >
                                    Try Again
                                </button>
                            )}
                            
                            <button 
                                onClick={() => window.location.reload()}
                                style={errorStyles.refreshButton}
                            >
                                Refresh Page
                            </button>

                            {showReportButton && (
                                <button 
                                    onClick={this.handleReportError}
                                    style={errorStyles.reportButton}
                                >
                                    Report Error
                                </button>
                            )}
                        </div>

                        <div style={errorStyles.helpText}>
                            If this problem persists, please copy the Error ID above and contact support.
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
        width: '100%',
    },
    errorBox: {
        backgroundColor: '#fff',
        border: '2px solid #dc3545',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '700px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    },
    title: {
        color: '#dc3545',
        marginBottom: '15px',
        fontSize: '1.5em',
        fontWeight: 'bold',
    },
    message: {
        color: '#666',
        marginBottom: '15px',
        lineHeight: '1.5',
        fontSize: '1.1em',
    },
    eventId: {
        color: '#495057',
        fontSize: '0.9em',
        marginBottom: '20px',
        padding: '8px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
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
        padding: '5px',
        borderRadius: '3px',
        transition: 'background-color 0.2s',
    },
    errorDetails: {
        fontSize: '0.85em',
        color: '#6c757d',
    },
    errorSection: {
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #e9ecef',
    },
    stack: {
        backgroundColor: '#343a40',
        color: '#fff',
        padding: '10px',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '0.75em',
        marginTop: '5px',
        maxHeight: '200px',
    },
    actions: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '25px',
        flexWrap: 'wrap',
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
        transition: 'background-color 0.2s',
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
        transition: 'background-color 0.2s',
    },
    reportButton: {
        backgroundColor: '#17a2b8',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '10px 20px',
        cursor: 'pointer',
        fontSize: '1em',
        fontWeight: 'bold',
        transition: 'background-color 0.2s',
    },
    helpText: {
        marginTop: '20px',
        fontSize: '0.9em',
        color: '#6c757d',
        fontStyle: 'italic',
    },
};

// Add hover effects
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        details summary:hover {
            background-color: #e9ecef !important;
        }
    `;
    document.head.appendChild(styleSheet);
}

export default ErrorBoundary;