import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';

export default function Workspace() {
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get('challenge');

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [code, setCode] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!challengeId) {
      setError("No challenge specified.");
      setLoading(false);
      return;
    }

    fetch(`/api/challenges/${challengeId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Challenge not found or not published');
        return res.json();
      })
      .then((data) => {
        setChallenge(data);
        setCode(data.starter_code || '# Write your solution here\n');
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [challengeId]);

  const handleRunCode = async () => {
    setIsRunning(true);
    const fileName = challenge?.editor_file_name || 'script.py';
    setTerminalOutput(`Executing ${fileName}...`);

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language_id: 71 }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to execute code');
      }

      setTerminalOutput(data.output);
    } catch (err) {
      setTerminalOutput(`Execution Error:\n\n${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font)' }}>Booting Workspace...</p>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'var(--font)' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Mission Aborted</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: '24px' }}>{error}</p>
        <Link to="/levels" style={{ background: 'var(--brand)', color: '#fff', padding: '10px 20px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}>Return to Navigation</Link>
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
      color: 'var(--text-1)',
      fontFamily: 'var(--font)'
    }}>
      
      {/* Left Pane (The Briefing - 40% width) */}
      <div style={{
        width: '40%',
        padding: '32px',
        overflowY: 'auto',
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0', lineHeight: 1.2, letterSpacing: '-0.02em', paddingBottom: '12px' }}>
              {challenge.title}
            </h1>
          </div>
          <Link to="/levels" style={{ padding: '8px 14px', color: 'var(--text-2)', textDecoration: 'none', border: '1px solid var(--border-md)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.15s ease' }} onMouseOver={e=>e.currentTarget.style.color='var(--text-1)'} onMouseOut={e=>e.currentTarget.style.color='var(--text-2)'}>
            ← Exit
          </Link>
        </div>

        {challenge.description && (
          <div style={{ 
            color: 'var(--text-2)', 
            lineHeight: '1.7', 
            fontSize: '1rem',
          }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '8px' }}>Context</h3>
            <div className="rich-text-display" dangerouslySetInnerHTML={{ __html: challenge.description.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {challenge.instructions && (
          <div style={{ 
            color: 'var(--text-1)', 
            lineHeight: '1.7', 
            fontSize: '1rem',
            background: 'var(--bg-card)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border-md)'
          }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-light)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Task
            </h3>
            <div className="rich-text-display" dangerouslySetInnerHTML={{ __html: challenge.instructions.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {challenge.hint_text && (
            <div>
              <button 
                onClick={() => setShowHint(!showHint)}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-md)',
                  color: 'var(--warning)',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={e=>e.currentTarget.style.background='var(--bg-hover)'}
                onMouseOut={e=>e.currentTarget.style.background='var(--bg-surface)'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/><path d="M16 12a4 4 0 0 1-8 0"/></svg>
                  {showHint ? 'Hide Hint' : 'Reveal Hint'}
                </span>
                <span>{showHint ? '▲' : '▼'}</span>
              </button>
              {showHint && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '16px', 
                  background: 'var(--warning-soft)', 
                  borderLeft: '3px solid var(--warning)',
                  color: 'var(--text-1)',
                  fontSize: '0.9rem',
                  borderRadius: '0 8px 8px 0',
                  lineHeight: '1.6'
                }}>
                  {challenge.hint_text}
                </div>
              )}
            </div>
          )}

          {challenge.walkthrough_video_url && (
            <a href={challenge.walkthrough_video_url} target="_blank" rel="noreferrer" style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', background: 'var(--bg-surface)', color: 'var(--info)', 
              border: '1px solid var(--border-md)', borderRadius: '8px', textDecoration: 'none',
              fontFamily: 'inherit', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s'
            }} onMouseOver={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseOut={e=>e.currentTarget.style.background='var(--bg-surface)'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Watch Walkthrough
            </a>
          )}

          {challenge.repo_link && (
            <a href={challenge.repo_link} target="_blank" rel="noreferrer" style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', background: 'var(--bg-surface)', color: 'var(--success)', 
              border: '1px solid var(--border-md)', borderRadius: '8px', textDecoration: 'none',
              fontFamily: 'inherit', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s'
            }} onMouseOver={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseOut={e=>e.currentTarget.style.background='var(--bg-surface)'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              View Official Solution
            </a>
          )}
        </div>
      </div>

      {/* Right Pane (The Canvas - 60% width) */}
      <div style={{
        width: '60%',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid #111'
      }}>
        {/* Top: The Editor */}
        <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Editor Header Tab */}
          <div style={{ padding: '4px 20px 0 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', minHeight: '40px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'var(--bg-surface)', border: '1px solid var(--brand-border)', borderRadius: '6px 6px 0 0', borderBottom: 'none', position: 'relative', bottom: '-1px', fontSize: '0.8rem', color: 'var(--brand-light)', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              {challenge.editor_file_name || 'script.py'}
            </div>
          </div>
          <div style={{ flexGrow: 1, paddingTop: '16px' }}>
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
              fontFamily: 'var(--font-mono)',
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
          </div>
        </div>

        {/* Bottom: The Terminal */}
        <div style={{
          height: '30vh',
          flexShrink: 0,
          background: '#0A0A0A',
          color: 'var(--text-1)',
          fontFamily: 'var(--font-mono)',
          borderTop: '2px solid var(--border-md)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.03)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Output Console</span>
            <button 
              onClick={handleRunCode}
              disabled={isRunning}
              style={{
                background: isRunning ? 'var(--bg-surface)' : 'var(--brand)',
                color: isRunning ? 'var(--text-3)' : '#fff',
                border: isRunning ? '1px solid var(--border)' : 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isRunning ? 'none' : '0 2px 10px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e=>!isRunning && (e.currentTarget.style.transform='translateY(-1px)')}
              onMouseOut={e=>!isRunning && (e.currentTarget.style.transform='translateY(0)')}
            >
              {!isRunning && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
              {isRunning ? 'Running...' : 'Run Code'}
            </button>
          </div>
          {/* Output Block */}
          <pre style={{
            margin: 0,
            padding: '20px',
            flexGrow: 1,
            overflowY: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: '#a3a3a3'
          }}>
            {terminalOutput}
          </pre>
        </div>
      </div>
      
    </div>
  );
}
