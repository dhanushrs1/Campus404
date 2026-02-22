import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';

function Arena() {
  const [searchParams] = useSearchParams();
  const levelId = searchParams.get('level');

  const [level, setLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [code, setCode] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');

  useEffect(() => {
    if (!levelId) {
      setError("No level specified.");
      setLoading(false);
      return;
    }

    fetch(`/api/levels/${levelId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Level not found or not published');
        return res.json();
      })
      .then((data) => {
        setLevel(data);
        setCode(data.broken_code || '# Write your solution here\n');
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [levelId]);

  const handleRunCode = () => {
    setTerminalOutput('Executing code...\n');
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-ui, var(--font))' }}>Loading Arena...</p>
      </div>
    );
  }

  if (error || !level) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'var(--font-ui, var(--font))' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Mission Aborted</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: '24px' }}>{error}</p>
        <Link to="/levels" style={{ background: 'var(--brand)', color: '#fff', padding: '10px 20px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}>Return to Levels</Link>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-base)',
      color: 'var(--text-primary, var(--text-1))',
      fontFamily: 'var(--font-ui, var(--font))'
    }}>
      
      {/* Left Pane (The Mission - 40% width) */}
      <div style={{
        width: '40%',
        padding: '2rem',
        overflowY: 'auto',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', marginBottom: '8px' }}>
              Level {level.order_number}
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0', lineHeight: 1.1 }}>
              {level.title}
            </h1>
          </div>
          <Link to="/levels" style={{ padding: '8px 16px', color: 'var(--text-2)', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600' }} className="btn-ghost-sm">
            ← Abort
          </Link>
        </div>

        <div style={{ 
          color: 'var(--text-2)', 
          lineHeight: '1.7', 
          fontSize: '1.05rem',
          background: 'rgba(0,0,0,0.2)',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          {level.description ? (
            <div dangerouslySetInnerHTML={{ __html: level.description.replace(/\n/g, '<br/>') }} />
          ) : (
            <p>No briefing available for this mission.</p>
          )}
        </div>

        {level.hint_text && (
          <div style={{ marginTop: 'auto' }}>
            <button 
              onClick={() => setShowHint(!showHint)}
              style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '12px 16px',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-primary, var(--text-1))',
                cursor: 'pointer',
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}
            >
              <span>{showHint ? 'Hide Hint' : 'Reveal Hint'}</span>
              <span>{showHint ? '▲' : '▼'}</span>
            </button>
            {showHint && (
              <div style={{ 
                marginTop: '12px', 
                padding: '16px', 
                background: 'rgba(99, 102, 241, 0.1)', 
                borderLeft: '4px solid var(--brand)',
                color: 'var(--text-primary, var(--text-1))',
                fontSize: '0.9rem',
                borderRadius: '0 8px 8px 0',
                lineHeight: '1.6'
              }}>
                {level.hint_text}
              </div>
            )}
          </div>
        )}

        {level.repo_link && (
          <a href={level.repo_link} target="_blank" rel="noreferrer" style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary, var(--text-1))', 
            border: '1px solid var(--border)', borderRadius: '8px', textDecoration: 'none',
            fontFamily: 'inherit', marginTop: level.hint_text ? '0' : 'auto',
            fontWeight: '600', fontSize: '0.95rem', transition: 'background 0.2s'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
            Clone Starter Repo
          </a>
        )}
      </div>

      {/* Right Pane (The Workspace - 60% width) */}
      <div style={{
        width: '60%',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-base)'
      }}>
        {/* Top: The Editor */}
        <div style={{ flexGrow: 1, overflow: 'hidden', paddingTop: '16px' }}>
          <Editor
            height="100%"
            width="100%"
            theme="vs-dark"
            language="python"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        </div>

        {/* Bottom: The Terminal */}
        <div style={{
          height: '250px',
          flexShrink: 0,
          background: '#0A0A0A',
          color: 'var(--text-primary, var(--text-1))',
          fontFamily: 'var(--font-mono, monospace)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Terminal</span>
            <button 
              onClick={handleRunCode}
              style={{
                background: 'var(--brand)',
                color: '#fff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui, var(--font))',
                fontWeight: '600',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              Run Code
            </button>
          </div>
          {/* Output Block */}
          <pre style={{
            margin: 0,
            padding: '16px',
            flexGrow: 1,
            overflowY: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {terminalOutput}
          </pre>
        </div>
      </div>
      
    </div>
  );
}

export default Arena;
