import React from 'react';

const containerStyle = {
  maxWidth: 560,
  margin: '80px auto',
  padding: '32px 28px',
  borderRadius: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  color: '#1e293b',
  textAlign: 'center',
};

const buttonStyle = {
  marginTop: 20,
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

/**
 * Catches render-time crashes so a single bad record (or a failed
 * localStorage write) shows a recoverable message instead of a blank page.
 * Styles are inline on purpose — a stylesheet failure must not take the
 * fallback UI down with it.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Unhandled render error:', error, errorInfo);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={containerStyle} role="alert">
        <h2 style={{ margin: '0 0 10px' }}>Something went wrong</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <button type="button" style={buttonStyle} onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
