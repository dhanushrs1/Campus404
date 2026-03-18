import React, { useEffect, useRef, useState } from 'react';
import './AdvancedRichEditor.css';

const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const buildTableHtml = (rows, cols) => {
  const bodyRows = Array.from({ length: rows })
    .map(() => {
      const cells = Array.from({ length: cols })
        .map(() => '<td>Cell</td>')
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const headers = Array.from({ length: cols })
    .map((_, idx) => `<th>Header ${idx + 1}</th>`)
    .join('');

  return `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table><p><br/></p>`;
};

export default function AdvancedRichEditor({
  value,
  onChange,
  onRequestImage,
  imageToInsert,
  placeholder = 'Write the Guide content here...',
}) {
  const editorRef = useRef(null);
  const sourceRef = useRef(null);
  const savedRangeRef = useRef(null);
  const lastImageInsertRef = useRef(null);

  const [sourceMode, setSourceMode] = useState(false);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const syncEditorValue = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    saveSelection();
  };

  const runCommand = (cmd, arg = null) => {
    if (sourceMode || !editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand(cmd, false, arg);
    syncEditorValue();
  };

  const insertHtml = (html) => {
    if (sourceMode || !editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncEditorValue();
  };

  const handleInsertTable = () => {
    const rowsInput = window.prompt('Number of rows', '3');
    const colsInput = window.prompt('Number of columns', '3');
    if (!rowsInput || !colsInput) return;

    const rows = clamp(Number(rowsInput) || 3, 1, 12);
    const cols = clamp(Number(colsInput) || 3, 1, 12);
    insertHtml(buildTableHtml(rows, cols));
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter URL', 'https://');
    if (!url) return;
    runCommand('createLink', url);
  };

  const handleSourceToggle = () => {
    if (!sourceMode) {
      setSourceMode(true);
      requestAnimationFrame(() => {
        if (!sourceRef.current) return;
        sourceRef.current.value = editorRef.current?.innerHTML || value || '';
      });
      return;
    }

    const html = sourceRef.current?.value || value || '';
    setSourceMode(false);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.innerHTML = html;
      onChange(html);
      editorRef.current.focus();
    });
  };

  useEffect(() => {
    const next = value || '';

    if (sourceMode) {
      if (sourceRef.current && sourceRef.current.value !== next) {
        sourceRef.current.value = next;
      }
      return;
    }

    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
  }, [sourceMode, value]);

  useEffect(() => {
    if (!imageToInsert?.id || imageToInsert.id === lastImageInsertRef.current) return;
    lastImageInsertRef.current = imageToInsert.id;

    const imgHtml = `<figure><img src="${imageToInsert.url}" alt="${imageToInsert.alt || ''}" /><figcaption>${imageToInsert.alt || ''}</figcaption></figure><p><br/></p>`;

    if (sourceMode) {
      const current = sourceRef.current?.value || value || '';
      const next = `${current}${imgHtml}`;
      if (sourceRef.current) {
        sourceRef.current.value = next;
      }
      onChange(next);
      return;
    }

    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, imgHtml);
    onChange(editorRef.current.innerHTML);
    saveSelection();
  }, [imageToInsert, sourceMode, value, onChange]);

  return (
    <div className="are-wrap">
      <div className="are-toolbar">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'h2'); }}>H2</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'h3'); }}>H3</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'p'); }}>P</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'blockquote'); }}>Quote</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'pre'); }}>Code</button>

        <span className="are-divider" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('bold'); }}><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('italic'); }}><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('underline'); }}><u>U</u></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('strikeThrough'); }}><s>S</s></button>

        <span className="are-divider" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('insertUnorderedList'); }}>List</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('insertOrderedList'); }}>1.</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('indent'); }}>Indent</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('outdent'); }}>Outdent</button>

        <span className="are-divider" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyLeft'); }}>Left</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyCenter'); }}>Center</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyRight'); }}>Right</button>

        <span className="are-divider" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }}>Table</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('insertHorizontalRule'); }}>Rule</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleInsertLink(); }}>Link</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('unlink'); }}>Unlink</button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => onRequestImage?.()}
        >
          Image
        </button>

        <span className="are-divider" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('undo'); }}>Undo</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('redo'); }}>Redo</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); runCommand('removeFormat'); }}>Clear</button>
        <button type="button" className={sourceMode ? 'active' : ''} onClick={handleSourceToggle}>
          HTML
        </button>
      </div>

      {sourceMode ? (
        <textarea
          ref={sourceRef}
          className="are-source"
          defaultValue={value || ''}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder="Write HTML source here..."
        />
      ) : (
        <div
          ref={editorRef}
          className="are-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={syncEditorValue}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={saveSelection}
        />
      )}
    </div>
  );
}
