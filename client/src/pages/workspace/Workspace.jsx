import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css as langCss } from '@codemirror/lang-css';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { api } from '../admin/curriculum/api';
import { API_URL } from '../../config';
import './Workspace.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const getLangExtension = (languageId) => {
  switch (Number(languageId)) {
    case 71: return python();
    case 63: return javascript({ jsx: true });
    case 74: return javascript({ typescript: true });
    case 0: return html();
    case 82: return sql();
    case 62: return java();
    case 54:
    case 50: return cpp();
    case 73: return rust();
    default: return langCss();
  }
};

const getLangLabel = (languageId) => {
  const map = {
    71: 'Python 3',
    63: 'JavaScript',
    74: 'TypeScript',
    62: 'Java',
    54: 'C++',
    50: 'C',
    60: 'Go',
    72: 'Ruby',
    73: 'Rust',
    82: 'SQL',
    0: 'HTML/CSS/JS',
  };
  return map[Number(languageId)] || `Language ${languageId}`;
};

const decodeBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function decryptEnvelope(envelope, jwtToken) {
  if (!envelope || !jwtToken) {
    throw new Error('Missing encrypted payload context.');
  }

  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this browser.');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(jwtToken));
  const key = await window.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(envelope.iv) },
    key,
    decodeBase64(envelope.ciphertext),
  );

  return JSON.parse(decoder.decode(plaintextBuffer));
}

const formatExecutionText = (executionPayload) => {
  const lines = [];

  lines.push(`Status: ${executionPayload.status?.description || 'Unknown'} (${executionPayload.status?.id ?? '-'})`);
  lines.push(`Time: ${executionPayload.time || '-'}s | Memory: ${executionPayload.memory ?? '-'} KB`);

  if (executionPayload.stdout) {
    lines.push('\n[stdout]');
    lines.push(executionPayload.stdout);
  }

  if (executionPayload.stderr) {
    lines.push('\n[stderr]');
    lines.push(executionPayload.stderr);
  }

  if (executionPayload.compile_output) {
    lines.push('\n[compile_output]');
    lines.push(executionPayload.compile_output);
  }

  if (!executionPayload.stdout && !executionPayload.stderr && !executionPayload.compile_output) {
    lines.push('\n(no output)');
  }

  return lines.join('\n');
};

export default function Workspace() {
  const { slug, moduleId, challengeId, levelNumber } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [labProgress, setLabProgress] = useState(null);
  const [moduleProgress, setModuleProgress] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [challenge, setChallenge] = useState(null);

  const [files, setFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const [terminalText, setTerminalText] = useState('> Ready. Run your code to see output.');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      setLoading(true);
      setError('');

      try {
        const progressRes = await fetch(`${API_URL}/labs/${slug}/progress`, { headers: authH() });
        if (!progressRes.ok) throw new Error('Unable to load lab progress.');

        const progressData = await progressRes.json();
        if (cancelled) return;

        const targetModule = (progressData.modules || []).find(
          (mod) => Number(mod.module_id) === Number(moduleId),
        );
        if (!targetModule) {
          navigate(`/labs/${slug}`);
          return;
        }

        let targetLevel = null;
        let targetChallenge = null;

        if (challengeId) {
          targetChallenge = (targetModule.challenge_groups || []).find(
            (group) => Number(group.challenge_id) === Number(challengeId),
          );

          if (!targetChallenge) {
            navigate(`/labs/${slug}/modules/${moduleId}`);
            return;
          }

          const groupLevels = targetChallenge.levels || [];
          const localIndex = Math.max(0, Number(levelNumber) - 1);
          targetLevel = groupLevels[localIndex] || null;
          if (!targetLevel || targetLevel.is_locked) {
            navigate(`/labs/${slug}/modules/${moduleId}/challenges/${challengeId}`);
            return;
          }
        } else {
          targetLevel = (targetModule.challenges || []).find(
            (lvl) => Number(lvl.level_number) === Number(levelNumber),
          );
          if (!targetLevel || targetLevel.is_locked) {
            navigate(`/labs/${slug}/modules/${moduleId}`);
            return;
          }
        }

        const levelDetail = await api.getLevel(targetLevel.challenge_id);
        if (cancelled) return;

        const normalizedFiles = (levelDetail.files || []).length
          ? levelDetail.files.map((file) => ({
              ...file,
              id: file.id,
              filename: file.filename || 'solution.txt',
              content: file.content || '',
              is_main: Boolean(file.is_main),
            }))
          : [{ id: 'main', filename: 'solution.txt', content: '', is_main: true }];

        const mainIdx = Math.max(0, normalizedFiles.findIndex((file) => file.is_main));

        setLabProgress(progressData);
        setModuleProgress(targetModule);
        setChallengeProgress(targetChallenge);
        setCurrentLevel(targetLevel);
        setChallenge(levelDetail);
        setFiles(normalizedFiles);
        setActiveFileIndex(mainIdx);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load workspace.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [slug, moduleId, challengeId, levelNumber, navigate]);

  const activeFile = files[activeFileIndex] || files[0] || null;
  const languageId = Number(labProgress?.language_id || 71);
  const levelPathBase = challengeId
    ? `/labs/${slug}/modules/${moduleId}/challenges/${challengeId}/level`
    : `/labs/${slug}/modules/${moduleId}/level`;

  const mainFileIndex = useMemo(() => {
    const idx = files.findIndex((file) => file.is_main);
    return idx >= 0 ? idx : 0;
  }, [files]);

  const writeToTerminal = (text, replace = false) => {
    setTerminalText((prev) => (replace ? text : `${prev}\n\n${text}`));
  };

  const updateActiveFileContent = (nextContent) => {
    setFiles((prev) => prev.map((file, idx) => (
      idx === activeFileIndex ? { ...file, content: nextContent } : file
    )));
  };

  const runLevel = async () => {
    if (!challenge || running || submitting) return;

    const sourceCode = files[mainFileIndex]?.content || '';
    if (!sourceCode.trim()) {
      writeToTerminal('[Run blocked] Main file is empty.');
      return;
    }

    setRunning(true);
    writeToTerminal('> Running code...');

    try {
      const response = await api.runWorkspaceLevel(challenge.id, {
        source_code: sourceCode,
        language_id: languageId,
      });

      const decrypted = await decryptEnvelope(response.envelope, token());
      writeToTerminal(formatExecutionText(decrypted), true);
    } catch (err) {
      writeToTerminal(`[Run failed] ${err.message || 'Unknown execution error.'}`);
    } finally {
      setRunning(false);
    }
  };

  const submitLevel = async () => {
    if (!challenge || submitting || running) return;

    const sourceCode = files[mainFileIndex]?.content || '';
    if (!sourceCode.trim()) {
      writeToTerminal('[Submit blocked] Main file is empty.');
      return;
    }

    setSubmitting(true);
    writeToTerminal('> Submitting level for XP...');

    const nonEmptyLines = sourceCode.split('\n').filter((line) => line.trim().length > 0).length;
    const optimizationScore = Math.max(0, Math.min(1, 1 - Math.max(nonEmptyLines - 50, 0) / 120));

    try {
      const response = await api.submitWorkspaceLevel(challenge.id, {
        source_code: sourceCode,
        language_id: languageId,
        exam_metrics: challenge.challenge_type === 'exam'
          ? {
              correct_answers: 1,
              total_questions: 1,
              optimization_score: optimizationScore,
            }
          : undefined,
      });

      const decrypted = await decryptEnvelope(response.envelope, token());
      const executionText = formatExecutionText(decrypted);

      const gate = response.module_gate;
      const gateText = `Progress Gate: ${gate.progress_percent}% / ${gate.unlock_threshold_percent}% (${gate.unlock_eligible ? 'UNLOCKED' : 'LOCKED'})`;
      const xpText = `XP Awarded: +${response.xp_gained} | Total XP: ${response.total_xp}`;

      writeToTerminal(`${executionText}\n\n${xpText}\n${gateText}`, true);

      if (response.passed) {
        if (challengeId && challengeProgress) {
          const levelsInGroup = challengeProgress.levels || [];
          const currentIndex = Math.max(0, Number(levelNumber) - 1);
          const nextLevel = levelsInGroup[currentIndex + 1];

          if (nextLevel) {
            setTimeout(() => navigate(`${levelPathBase}/${currentIndex + 2}`), 900);
          } else {
            setTimeout(() => navigate(`/labs/${slug}/modules/${moduleId}/challenges/${challengeId}`), 900);
          }
        } else {
          const nextLevel = (moduleProgress?.challenges || []).find(
            (lvl) => Number(lvl.level_number) === Number(levelNumber) + 1,
          );

          if (nextLevel) {
            setTimeout(() => navigate(`${levelPathBase}/${nextLevel.level_number}`), 900);
          } else {
            setTimeout(() => navigate(`/labs/${slug}/modules/${moduleId}`), 900);
          }
        }
      }
    } catch (err) {
      writeToTerminal(`[Submit failed] ${err.message || 'Unknown submission error.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="ws-loading">Loading workspace...</div>;
  }

  if (error || !moduleProgress || !currentLevel || !challenge) {
    return (
      <div className="ws-error">
        <h2>{error || 'Workspace unavailable.'}</h2>
        <button
          type="button"
          onClick={() => navigate(challengeId ? `/labs/${slug}/modules/${moduleId}/challenges/${challengeId}` : `/labs/${slug}/modules/${moduleId}`)}
        >
          Back to Module
        </button>
      </div>
    );
  }

  return (
    <div className="ws-shell">
      <header className="ws-header">
        <button
          type="button"
          className="ws-back-btn"
          onClick={() => navigate(challengeId ? `/labs/${slug}/modules/${moduleId}/challenges/${challengeId}` : `/labs/${slug}/modules/${moduleId}`)}
        >
          {challengeId ? 'Back to Challenge' : 'Back to Module'}
        </button>

        <div className="ws-level-track">
          {((challengeId ? challengeProgress?.levels : moduleProgress.challenges) || []).map((lvl, idx) => {
            let stateClass = 'future';
            if (lvl.is_completed) stateClass = 'done';
            const isCurrent = challengeId
              ? Number(idx + 1) === Number(levelNumber)
              : Number(lvl.level_number) === Number(levelNumber);
            if (isCurrent) stateClass = 'current';
            return <span key={lvl.challenge_id} className={`ws-level-dot ${stateClass}`} title={lvl.display_title} />;
          })}
        </div>

        <div className="ws-header-meta">
          <span>{moduleProgress.title}</span>
          <strong>{labProgress?.earned_xp || 0} XP</strong>
        </div>
      </header>

      <div className="ws-grid">
        <section className="ws-pane ws-left-pane">
          <div className="ws-left-head">
            <h2>{currentLevel.display_title || `Level ${currentLevel.level_number}`}</h2>
            <span className="ws-xp-chip">+{challenge.xp_reward} XP</span>
          </div>

          <div className="ws-level-meta">
            <span className={`ws-type-chip ${challenge.challenge_type}`}>{challenge.challenge_type === 'exam' ? 'Module Exam' : 'Standard Level'}</span>
            <span>Language: {getLangLabel(languageId)}</span>
          </div>

          <div className="ws-level-content" dangerouslySetInnerHTML={{ __html: challenge.content_html || '' }} />
        </section>

        <section className="ws-pane ws-right-pane">
          <div className="ws-editor-pane">
            <div className="ws-editor-toolbar">
              <div className="ws-file-tabs" role="tablist" aria-label="Level files">
                {files.map((file, idx) => (
                  <button
                    key={file.id || `${file.filename}-${idx}`}
                    type="button"
                    className={`ws-file-tab ${idx === activeFileIndex ? 'active' : ''}`}
                    onClick={() => setActiveFileIndex(idx)}
                  >
                    {file.is_main ? '★ ' : ''}{file.filename}
                  </button>
                ))}
              </div>
              <span className="ws-lang-chip">{getLangLabel(languageId)}</span>
            </div>

            <div className="ws-codemirror-wrap">
              <CodeMirror
                value={activeFile?.content || ''}
                theme={oneDark}
                height="100%"
                extensions={[getLangExtension(languageId)]}
                onChange={updateActiveFileContent}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  history: true,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  closeBracketsKeymap: true,
                  defaultKeymap: true,
                  searchKeymap: true,
                  historyKeymap: true,
                  foldKeymap: true,
                  completionKeymap: true,
                  tabSize: 2,
                }}
              />
            </div>
          </div>

          <div className="ws-terminal-pane">
            <div className="ws-terminal-toolbar">
              <strong>Terminal</strong>
              <div className="ws-terminal-actions">
                <button type="button" className="ws-btn-run" onClick={runLevel} disabled={running || submitting}>
                  {running ? 'Running...' : 'Run'}
                </button>
                <button type="button" className="ws-btn-submit" onClick={submitLevel} disabled={submitting || running}>
                  {submitting ? 'Submitting...' : 'Submit for XP'}
                </button>
              </div>
            </div>
            <pre className="ws-terminal-output">{terminalText}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
