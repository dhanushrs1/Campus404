import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
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
import { api } from '../curriculum/api';
import MediaPickerModal from '../../../components/MediaPickerModal/MediaPickerModal';
import './ChallengeForm.css';

/* ── Language extension map ─────────────────────────────── */
const getLangExtension = (ext) => {
  switch (ext) {
    case 'py':   return python();
    case 'js':   return javascript({ jsx: true });
    case 'ts':   return javascript({ typescript: true });
    case 'html': return html();
    case 'css':  return langCss();
    case 'java': return java();
    case 'cpp':
    case 'c':    return cpp();
    case 'sql':  return sql();
    case 'rs':   return rust();
    default:     return [];
  }
};

const getExtFromFilename = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const MAX_FILES = 5;

/* ── Rich Text Editor ───────────────────────────────────── */
const RTE_COMMANDS = [
  { cmd: 'formatBlock', arg: 'h1',     label: 'H1',    title: 'Heading 1', section: 'blocks' },
  { cmd: 'formatBlock', arg: 'h2',     label: 'H2',    title: 'Heading 2', section: 'blocks' },
  { cmd: 'formatBlock', arg: 'h3',     label: 'H3',    title: 'Heading 3', section: 'blocks' },
  { cmd: 'formatBlock', arg: 'p',      label: 'P',     title: 'Paragraph', section: 'blocks' },
  { cmd: 'formatBlock', arg: 'pre',    label: '</>',   title: 'Code block', section: 'blocks' },
  null, // divider
  { cmd: 'bold',                        label: <b>B</b>,   title: 'Bold',      section: 'inline' },
  { cmd: 'italic',                      label: <i>I</i>,   title: 'Italic',    section: 'inline' },
  { cmd: 'underline',                   label: <u>U</u>,   title: 'Underline', section: 'inline' },
  { cmd: 'strikeThrough',               label: <s>S</s>,   title: 'Strike',    section: 'inline' },
  null,
  { cmd: 'insertUnorderedList',         label: '• List', title: 'Bullet list',   section: 'lists' },
  { cmd: 'insertOrderedList',           label: '1. List',title: 'Numbered list', section: 'lists' },
  { cmd: 'indent',                      label: '→',     title: 'Indent',     section: 'lists' },
  { cmd: 'outdent',                     label: '←',     title: 'Outdent',    section: 'lists' },
  null,
  { cmd: 'justifyLeft',                 label: '⇤',     title: 'Align left',   section: 'align' },
  { cmd: 'justifyCenter',               label: '⇔',     title: 'Center',       section: 'align' },
  { cmd: 'justifyRight',                label: '⇥',     title: 'Align right',  section: 'align' },
  null,
  { cmd: 'removeFormat',                label: '✕ fmt', title: 'Clear formatting', section: 'util' },
];

function RichTextEditor({ value, onChange, onImageInsert }) {
  const editorRef  = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && editorRef.current && value) {
      editorRef.current.innerHTML = value;
      initialized.current = true;
    }
  }, [value]);

  const exec = (cmd, arg) => {
    editorRef.current.focus();
    if (cmd === 'formatBlock') {
      document.execCommand(cmd, false, arg);
    } else {
      document.execCommand(cmd, false, arg || null);
    }
    onChange(editorRef.current.innerHTML);
  };

  const handleLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) document.execCommand('createLink', false, url);
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        {RTE_COMMANDS.map((cmd, i) => {
          if (cmd === null) return <span key={i} className="rte-divider" />;
          return (
            <button
              key={cmd.title}
              type="button"
              title={cmd.title}
              className="rte-btn"
              onMouseDown={e => { e.preventDefault(); exec(cmd.cmd, cmd.arg); }}
            >
              {cmd.label}
            </button>
          );
        })}
        <span className="rte-divider" />
        <button type="button" className="rte-btn rte-link-btn" title="Insert link" onMouseDown={e => { e.preventDefault(); handleLink(); }}>
          🔗
        </button>
        <button type="button" className="rte-btn rte-img-btn" title="Insert image" onClick={onImageInsert}>
          🖼
        </button>
      </div>
      <div
        ref={editorRef}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current.innerHTML)}
        data-placeholder="Write the problem statement here — use headings, lists, code blocks, and images to explain the challenge clearly…"
      />
    </div>
  );
}

/* ── Multi-file code editor ─────────────────────────────── */
function FileTab({ file, isActive, isMain, onClick, onRename, onSetMain, onRemove, canRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(file.filename);
  const inputRef = useRef(null);

  const commitRename = () => {
    setEditing(false);
    if (name.trim()) onRename(name.trim());
    else setName(file.filename);
  };

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  return (
    <div className={`cf-ftab ${isActive ? 'active' : ''} ${isMain ? 'main' : ''}`} onClick={onClick}>
      {isMain && <span className="cf-ftab-main" title="Main file">★</span>}
      {editing ? (
        <input
          ref={inputRef}
          className="cf-ftab-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setName(file.filename); } }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="cf-ftab-name" onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}>
          {file.filename}
        </span>
      )}
      <div className="cf-ftab-actions" onClick={e => e.stopPropagation()}>
        {!isMain && <button className="cf-ftab-btn" title="Set as main" onClick={onSetMain}>★</button>}
        {canRemove && <button className="cf-ftab-btn cf-ftab-del" title="Remove file" onClick={onRemove}>×</button>}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
const INITIAL = {
  module_id:    0,
  custom_title: '',
  xp_reward:    50,
  content_html: '',
  is_published: false,
};

const newFile = (filename, idx) => ({ id: `new_${Date.now()}_${idx}`, filename, content: '', is_main: idx === 0 });

export default function ChallengeForm() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const { challengeId } = useParams();
  const isEdit          = Boolean(challengeId);

  const [form,         setForm]         = useState(INITIAL);
  const [module,       setModule]       = useState(null);
  const [lab,          setLab]          = useState(null);
  const [challenges,   setChallenges]   = useState([]);
  const [langExt,      setLangExt]      = useState('py');
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [showImgPicker,setShowImgPicker]= useState(false);
  const [activeTab,    setActiveTab]    = useState('content');
  const [files,        setFiles]        = useState([newFile('solution.py', 0)]);
  const [activeFile,   setActiveFile]   = useState(0);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getExtFromLangId = (id) => {
    const map = { 71:'py', 63:'js', 62:'java', 54:'cpp', 50:'c', 60:'go', 72:'rb', 73:'rs', 78:'kt', 74:'ts', 82:'sql', 79:'sh', 0:'html' };
    return map[id] || 'txt';
  };

  useEffect(() => {
    const moduleId = Number(params.get('module_id'));

    const setBestExt = (l) => {
      if (l?.language_id) setLangExt(getExtFromLangId(l.language_id));
    };

    if (isEdit) {
      api.getChallenge(challengeId).then(ch => {
        setForm({ ...INITIAL, module_id: ch.module_id, custom_title: ch.custom_title || '', xp_reward: ch.xp_reward, content_html: ch.content_html, is_published: ch.is_published });
        if (ch.files?.length) setFiles(ch.files.map(f => ({ ...f, id: f.id })));
        return api.getModule(ch.module_id);
      }).then(mod => { setModule(mod); return Promise.all([api.getLab(mod.lab_id)]); })
        .then(([l]) => {
          setLab(l);
          setBestExt(l);
        }).catch(e => showToast(e.message, 'error'));
    } else if (moduleId) {
      setForm(f => ({ ...f, module_id: moduleId }));
      api.getModule(moduleId).then(mod => {
        setModule(mod);
        return Promise.all([api.getLab(mod.lab_id), api.getChallenges(moduleId)]);
      }).then(([l, chs]) => {
        setLab(l);
        setChallenges(chs);
        setBestExt(l);
        // Default filename based on lab language
        const ext = getExtFromLangId(l?.language_id || 71);
        setFiles([newFile(`solution.${ext}`, 0)]);
      }).catch(e => showToast(e.message, 'error'));
    }
  }, [challengeId, isEdit, params]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── File operations ─── */
  const addFile = () => {
    if (files.length >= MAX_FILES) return showToast(`Max ${MAX_FILES} files per challenge.`, 'error');
    const ext = langExt;
    const idx = files.length;
    const name = `file${idx + 1}.${ext}`;
    setFiles(f => [...f, newFile(name, idx)]);
    setActiveFile(idx);
  };

  const removeFile = (idx) => {
    if (files.length <= 1) return;
    const newFiles = files.filter((_, i) => i !== idx);
    // Ensure main exists
    if (!newFiles.some(f => f.is_main)) newFiles[0].is_main = true;
    setFiles(newFiles);
    setActiveFile(Math.max(0, idx - 1));
  };

  const renameFile = (idx, name) => {
    setFiles(f => f.map((file, i) => i === idx ? { ...file, filename: name } : file));
  };

  const setMainFile = (idx) => {
    setFiles(f => f.map((file, i) => ({ ...file, is_main: i === idx })));
  };

  const setFileContent = (idx, content) => {
    setFiles(f => f.map((file, i) => i === idx ? { ...file, content } : file));
  };

  /* ── Image insert (RTE) ─── */
  const insertImageIntoRTE = ({ url, alt }) => {
    setShowImgPicker(false);
    set('content_html', form.content_html + `<img src="${url}" alt="${alt || ''}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`);
  };

  /* ── Submit ─── */
  const handleSubmit = async () => {
    if (!form.content_html.trim()) { showToast('Problem statement is required.', 'error'); return; }
    if (!form.module_id)           { showToast('No module selected.', 'error'); return; }
    if (!files.some(f => f.is_main)) { showToast('One file must be marked as the main file.', 'error'); return; }

    setSaving(true);
    try {
      let challenge;
      const payload = {
        module_id:    form.module_id,
        custom_title: form.custom_title || null,
        xp_reward:    Number(form.xp_reward),
        content_html: form.content_html,
        is_published: form.is_published,
        files: files.map((f, i) => ({ filename: f.filename, content: f.content, is_main: f.is_main, order_index: i })),
      };

      if (isEdit) {
        challenge = await api.updateChallenge(challengeId, {
          custom_title: payload.custom_title,
          xp_reward:    payload.xp_reward,
          content_html: payload.content_html,
          is_published: payload.is_published,
        });
        // Update files separately
        await api.replaceChallengeFiles(challengeId, payload.files);
        showToast('Challenge updated!');
        setTimeout(() => navigate('/admin/labs'), 1200);
      } else {
        challenge = await api.createChallenge(payload);
        showToast(`Level ${challenge.level_number} created!`);
        setTimeout(() => {
          if (confirm(`Level ${challenge.level_number} saved!\nAdd another level to this module?`)) {
            window.location.reload();
          } else {
            navigate('/admin/labs');
          }
        }, 400);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const nextLevel = challenges.length + 1;
  const currentFile = files[activeFile] || files[0];
  const currentExt  = currentFile ? getExtFromFilename(currentFile.filename) : langExt;

  return (
    <div className="cf-wrap">
      {toast && <div className={`cf-toast ${toast.type}`}>{toast.msg}</div>}
      {showImgPicker && (
        <MediaPickerModal title="Insert Image" showAlt={true}
          onSelect={insertImageIntoRTE} onClose={() => setShowImgPicker(false)} />
      )}

      {/* Breadcrumb */}
      <div className="cf-breadcrumb">
        <button onClick={() => navigate('/admin/labs')}>Labs</button>
        {lab    && <><span>›</span><span>{lab.title}</span></>}
        {module && <><span>›</span><span>{module.title}</span></>}
        <span>›</span>
        <span>{isEdit ? 'Edit Challenge' : `Level ${nextLevel}`}</span>
      </div>

      {/* Steps */}
      {!isEdit && (
        <div className="cf-steps">
          <div className="cf-step done"><span>1</span>Create Lab</div>
          <div className="cf-step-line done" />
          <div className="cf-step done"><span>2</span>Add Module</div>
          <div className="cf-step-line done" />
          <div className="cf-step current"><span>3</span>Add Challenges</div>
        </div>
      )}

      <div className="cf-layout">
        {/* ── LEFT ── */}
        <div className="cf-main">
          <div className="cf-header">
            <h2 className="cf-title">{isEdit ? 'Edit Challenge' : `Creating Level ${nextLevel}`}</h2>
            {module && <p className="cf-subtitle">Module: <strong>{module.title}</strong></p>}
          </div>

          {!isEdit && challenges.length > 0 && (
            <div className="cf-levels-bar">
              {challenges.map(ch => <span key={ch.id} className="cf-level-chip done">{ch.display_title}</span>)}
              <span className="cf-level-chip current">Level {nextLevel} ← here</span>
            </div>
          )}

          {/* Main tabs */}
          <div className="cf-tabs">
            <button className={`cf-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>📝 Problem Statement</button>
            <button className={`cf-tab ${activeTab === 'code' ? 'active' : ''}`}    onClick={() => setActiveTab('code')}>💻 Code Editor</button>
          </div>

          {/* ── PROBLEM STATEMENT ── */}
          {activeTab === 'content' && (
            <div className="cf-panel">
              <RichTextEditor value={form.content_html} onChange={v => set('content_html', v)} onImageInsert={() => setShowImgPicker(true)} />
            </div>
          )}

          {/* ── CODE EDITOR ── */}
          {activeTab === 'code' && (
            <div className="cf-panel cf-code-panel">
              {/* File tabs bar */}
              <div className="cf-file-tabs-wrap">
                <div className="cf-file-tabs">
                  {files.map((file, idx) => (
                    <FileTab
                      key={file.id}
                      file={file}
                      isActive={activeFile === idx}
                      isMain={file.is_main}
                      onClick={() => setActiveFile(idx)}
                      onRename={name => renameFile(idx, name)}
                      onSetMain={() => setMainFile(idx)}
                      onRemove={() => removeFile(idx)}
                      canRemove={files.length > 1}
                    />
                  ))}
                </div>
                {files.length < MAX_FILES && (
                  <button className="cf-add-file-btn" onClick={addFile} title={`Add file (${files.length}/${MAX_FILES})`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New File
                  </button>
                )}
              </div>

              {/* File info bar */}
              {currentFile && (
                <div className="cf-file-info">
                  <span className="cf-file-info-name">{currentFile.filename}</span>
                  {currentFile.is_main && <span className="cf-main-badge">⭐ Main Entry</span>}
                  <span className="cf-double-click-hint">Double-click tab name to rename</span>
                </div>
              )}

              {/* CodeMirror editor */}
              <div className="cf-cm-wrap">
                <CodeMirror
                  value={currentFile?.content || ''}
                  height="420px"
                  theme={oneDark}
                  extensions={[getLangExtension(currentExt)]}
                  onChange={val => setFileContent(activeFile, val)}
                  basicSetup={{
                    lineNumbers:       true,
                    foldGutter:        true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    history:           true,
                    drawSelection:     true,
                    dropCursor:        true,
                    allowMultipleSelections: true,
                    indentOnInput:     true,
                    syntaxHighlighting: true,
                    bracketMatching:   true,
                    closeBrackets:     true,
                    autocompletion:    true,
                    rectangularSelection:true,
                    crosshairCursor:   false,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    defaultKeymap:     true,
                    searchKeymap:      true,
                    historyKeymap:     true,
                    foldKeymap:        true,
                    completionKeymap:  true,
                    lintKeymap:        true,
                    tabSize:           4,
                  }}
                />
              </div>

              {/* Multi-file tips */}
              <div className="cf-file-tips">
                <span>💡 <strong>Tips:</strong> Double-click a tab to rename it · Mark the main file with ★ · Students will see the main file first</span>
                {files.length > 1 && (
                  <span>· Files: {files.map(f => f.filename).join(', ')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="cf-sidebar">
          <div className="cf-card">
            <h4 className="cf-card-title">Publish</h4>
            <label className="cf-toggle">
              <input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} />
              <span className="cf-toggle-track" />
              <span className="cf-toggle-label">{form.is_published ? 'Published' : 'Draft'}</span>
            </label>
          </div>

          <div className="cf-card">
            <h4 className="cf-card-title">Custom Title</h4>
            <input
              className="cf-input"
              value={form.custom_title}
              onChange={e => set('custom_title', e.target.value)}
              placeholder={`Level ${nextLevel} (default)`}
            />
            <small className="cf-hint">Leave blank to auto-title "Level {nextLevel}"</small>
          </div>

          <div className="cf-card">
            <h4 className="cf-card-title">XP Reward</h4>
            <div className="cf-xp-row">
              <input type="number" min="1" max="10000" className="cf-input cf-xp-num"
                value={form.xp_reward} onChange={e => set('xp_reward', e.target.value)} />
              <span className="cf-xp-unit">XP</span>
            </div>
            <div className="cf-xp-presets">
              {[25, 50, 100, 200].map(v => (
                <button key={v} type="button"
                  className={`cf-preset ${form.xp_reward == v ? 'active' : ''}`}
                  onClick={() => set('xp_reward', v)}>{v}</button>
              ))}
            </div>
          </div>

          {/* File summary */}
          {activeTab === 'code' && files.length > 0 && (
            <div className="cf-card">
              <h4 className="cf-card-title">Files ({files.length}/{MAX_FILES})</h4>
              {files.map((f) => (
                <div key={f.id} className="cf-file-summary">
                  {f.is_main && <span title="Main">★</span>}
                  <span className="cf-fs-name">{f.filename}</span>
                  <span className="cf-fs-lines">{f.content.split('\n').length}L</span>
                </div>
              ))}
            </div>
          )}

          <div className="cf-card cf-actions-card">
            <button className="cf-btn-save" onClick={handleSubmit} disabled={saving}>
              {saving ? <><div className="cf-spinner" /> Saving…</> : isEdit ? '✓ Save Changes' : `Save Level ${nextLevel}`}
            </button>
            <button className="cf-btn-cancel" onClick={() => navigate('/admin/labs')}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
