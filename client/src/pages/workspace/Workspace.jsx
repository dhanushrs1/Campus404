import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../admin/curriculum/api';
import './Workspace.css';

export default function Workspace() {
  const { slug, moduleId, levelNumber } = useParams();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(true);

  // Default avatars and xp for UI demo
  const userXp = 540;
  
  useEffect(() => {
    // Fetch challenges for this module
    api.getChallenges(moduleId).then(data => {
      // sort by order_index
      const sorted = [...data].sort((a, b) => a.order_index - b.order_index);
      setChallenges(sorted);
      const idx = parseInt(levelNumber) - 1;
      if (idx >= 0 && idx < sorted.length) {
        setCurrentLevelIndex(idx);
        setCurrentChallenge(sorted[idx]);
        setCode(sorted[idx].starter_code || '# Write your code here');
      } else {
        // invalid level, navigate to dashboard
        navigate(`/labs/${slug}/modules/${moduleId}`);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      navigate(`/labs/${slug}/modules/${moduleId}`);
    });
  }, [slug, moduleId, levelNumber, navigate]);

  const handleRun = () => {
     // Mock run
     setOutput('Running code...\nOutputs: Hello World!');
  };

  const handleSubmit = () => {
     // Mock submit
     setOutput('Running tests...\nAll tests passed! +50 XP.\nRouting to next level...');
     setTimeout(() => {
       const nextLevel = currentLevelIndex + 2; // +1 for 0-index, +1 to advance
       if (nextLevel <= challenges.length) {
         navigate(`/labs/${slug}/modules/${moduleId}/level/${nextLevel}`);
       } else {
         navigate(`/labs/${slug}/modules/${moduleId}`); // Module complete
       }
     }, 1500);
  };

  if (loading) return <div className="ws-loading">Loading Workspace...</div>;

  return (
    <div className="workspace-container">
      {/* Zone A: Header */}
      <header className="ws-header">
        <div className="ws-header-left">
          <button className="ws-back-btn" onClick={() => navigate(`/labs/${slug}/modules/${moduleId}`)}>
            &lt; Back to Module
          </button>
        </div>
        
        <div className="ws-header-center">
          {challenges.map((c, i) => {
            let dotClass = 'ws-dot-future';
            if (i < currentLevelIndex) dotClass = 'ws-dot-completed';
            else if (i === currentLevelIndex) dotClass = 'ws-dot-current';
            return <div key={c.id || i} className={`ws-dot ${dotClass}`} />;
          })}
        </div>

        <div className="ws-header-right">
          <span className="ws-xp">{userXp} XP</span>
          <div className="ws-avatar">🐶</div>
        </div>
      </header>

      {/* Split pane for B and C */}
      <div className="ws-split">
        
        {/* Zone B: Left Panel */}
        <div className="ws-panel-left">
          <div className="ws-content-header">
            <h2>{currentChallenge?.title || `Level ${parseInt(levelNumber)}: Challenge`}</h2>
            <span className="ws-reward">+{currentChallenge?.xp_reward || 10} XP</span>
          </div>
          <div className="ws-content-body">
            {currentChallenge?.content_html ? (
               <div dangerouslySetInnerHTML={{ __html: currentChallenge.content_html }} />
            ) : (
               <p>{currentChallenge?.description || 'No content provided for this challenge.'}</p>
            )}
            
            <div className="ws-rules">
              <h3>Rules</h3>
              <p>Write standard output that exactly matches the hidden test cases.</p>
            </div>
          </div>
        </div>

        {/* Zone C: Right Panel */}
        <div className="ws-panel-right">
          <div className="ws-split-vertical">
            
            <div className="ws-editor-container">
              <div className="ws-editor-header">
                <span className="ws-lang-badge">Python 3</span>
              </div>
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="python"
                value={code}
                onChange={(val) => setCode(val)}
                options={{ minimap: { enabled: false }, fontSize: 14 }}
              />
            </div>

            <div className="ws-terminal-container">
               <div className="ws-terminal-actions">
                  <button className="ws-btn-run" onClick={handleRun}>Run Code</button>
                  <button className="ws-btn-submit" onClick={handleSubmit}>Submit for XP</button>
               </div>
               <div className="ws-terminal-console">
                 <pre>{output || '> Ready to run'}</pre>
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
