import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SystemLogs.css';

import { API_URL } from '../../../config';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState('campus_backend');
  const [lines, setLines] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Advanced features state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all'); // all, info, warn, error
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const logsViewerRef = useRef(null);
  const logsEndRef = useRef(null);

  const fetchContainers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/system-logs/containers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch containers');
      const data = await res.json();
      setContainers(data.containers || []);
    } catch (err) {
      console.error(err);
      setContainers([
        { name: 'campus_backend' },
        { name: 'campus_frontend' },
        { name: 'campus_db' },
        { name: 'campus_sandbox_api' }
      ]);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      // No trailing slash to avoid 307 redirects
      const res = await fetch(
        `${API_URL}/admin/system-logs?container_name=${selectedContainer}&lines=${lines}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch logs');
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedContainer, lines]);

  useEffect(() => {
    fetchContainers();
  }, []);

  useEffect(() => {
    fetchLogs();
    
    let interval;
    // Only poll if autoRefresh is enabled! Saves CPU/Network
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 10000); // Increased polling to 10s to further reduce overhead
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchLogs, autoRefresh]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logsViewerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsViewerRef.current;
    
    // Disable auto-scroll if user scrolls up artificially to read logs
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const copyToClipboard = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      alert('Logs copied to clipboard!');
    });
  };

  const getLogDetails = (line) => {
    const text = line.toLowerCase();
    let level = 'info';
    
    // Advanced parsing logic to color-code the logs
    if (text.includes('error') || text.includes('exception') || text.includes('traceback') || text.includes('fail') || text.includes('warn:')) {
      level = 'error';
    } else if (text.includes('warn') || text.includes('warning')) {
      level = 'warn';
    } else if (text.includes('debug')) {
      level = 'debug';
    }

    return { level, className: `log-line level-${level}` };
  };

  const filteredLogs = logs.filter(log => {
    const details = getLogDetails(log);
    
    if (filterLevel !== 'all' && details.level !== filterLevel) return false;
    if (searchTerm && !log.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="system-logs-container">
      <div className="logs-header">
        <div className="header-left">
          <h2>System Logs</h2>
          <p>Advanced real-time observability console</p>
        </div>
        
        <div className="header-actions">
          <select 
            value={selectedContainer} 
            onChange={(e) => setSelectedContainer(e.target.value)}
            className="logs-select"
          >
            {containers.map((c, i) => (
              <option key={i} value={c.name}>{c.name} {c.status ? `(${c.status})` : ''}</option>
            ))}
          </select>
          <select 
            value={lines} 
            onChange={(e) => setLines(Number(e.target.value))}
            className="logs-select"
          >
            <option value={50}>50 Lines</option>
            <option value={100}>100 Lines</option>
            <option value={500}>500 Lines</option>
            <option value={1000}>1000 Lines</option>
          </select>
          
          <button 
            className={`logs-action-btn ${autoRefresh ? 'active-pulse' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Pause stream" : "Resume stream"}
          >
            {autoRefresh ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Live</>
            )}
          </button>
          
          <button className="logs-action-btn" onClick={copyToClipboard}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy
          </button>
          
          <button 
            className="logs-refresh-btn" 
            onClick={fetchLogs} 
            disabled={loading}
          >
            {loading ? (
              <svg className="logs-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Sync</>
            )}
          </button>
        </div>
      </div>

      <div className="logs-toolbar">
         <div className="logs-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search raw logs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         <div className="logs-filters">
            <label className="filter-label">Level:</label>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="logs-select slim">
               <option value="all">All Items</option>
               <option value="error">Errors Only</option>
               <option value="warn">Warnings Only</option>
               <option value="info">Info/System</option>
            </select>
         </div>
         <div className="logs-toggles">
            <label className="logs-checkbox">
              <input 
                type="checkbox" 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)} 
              />
              <span className="checkmark"></span>
              Auto-Scroll Bottom
            </label>
         </div>
      </div>

      {error ? (
        <div className="logs-error">{error}</div>
      ) : (
        <div className="logs-viewer-wrapper">
          <div className="logs-viewer" ref={logsViewerRef} onScroll={handleScroll}>
            {filteredLogs.length === 0 ? (
              <div className="no-logs">
                {logs.length === 0 
                  ? "No logs available for this container. Did it output anything?" 
                  : "No matching logs found for your search filters."}
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const { className } = getLogDetails(log);

                // Quick visual extraction of docker timestamps (e.g., 2026-03-14T15:36:30.166Z)
                const timestampMatch = log.match(/^([\d-]{10}T[\d:.]+Z?)/);
                let displayLog = log;
                let timestamp = "";
                
                if (timestampMatch) {
                    timestamp = timestampMatch[0];
                    displayLog = log.substring(timestamp.length).trim();
                }

                return (
                  <div key={index} className={className}>
                    {timestamp && <span className="log-timestamp">[{timestamp}]</span>}
                    <span className="log-message">{displayLog}</span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemLogs;