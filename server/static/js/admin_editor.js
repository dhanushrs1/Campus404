/**
 * admin_editor.js — Campus404
 * Custom Vanilla JS Rich Text Editor & Code Editor
 * Zero external CSS/JS dependencies.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ── 1. Code Editor Textareas ──────────────────────────────────
    const codeEditors = document.querySelectorAll('textarea.code-editor');
    codeEditors.forEach(editor => {
        editor.addEventListener('keydown', function(e) {
            // Indentation with Tab
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                // Set textarea value to: text before caret + 4 spaces + text after caret
                this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
                // Put caret at right position again
                this.selectionStart = this.selectionEnd = start + 4;
            }

            // Auto-close brackets
            const brackets = {
                '{': '}',
                '[': ']',
                '(': ')',
                '"': '"',
                "'": "'"
            };

            if (brackets[e.key]) {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                const char = e.key;
                const closeChar = brackets[char];
                
                // If there's a selection, wrap it
                if (start !== end) {
                    const selectedText = this.value.substring(start, end);
                    this.value = this.value.substring(0, start) + char + selectedText + closeChar + this.value.substring(end);
                    this.selectionStart = start;
                    this.selectionEnd = end + 2; // +2 for the new brackets
                } else {
                    // Just insert the brackets
                    this.value = this.value.substring(0, start) + char + closeChar + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 1;
                }
            }

            // Auto-indent on Enter
            if (e.key === 'Enter') {
                const start = this.selectionStart;
                const currentLine = this.value.substring(0, start).split('\n').pop();
                
                // Find leading spaces of the current line
                const match = currentLine.match(/^\s*/);
                const spaces = match ? match[0] : '';

                if (spaces.length > 0) {
                    e.preventDefault();
                    // Insert newline + the same spaces
                    this.value = this.value.substring(0, start) + '\n' + spaces + this.value.substring(this.selectionEnd);
                    this.selectionStart = this.selectionEnd = start + 1 + spaces.length;
                }
            }
        });
    });


    // ── 3. Custom Modal Manager ──────────────────────────────────────
const ModalManager = {
    overlay: null,

    init() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'rte-modal-overlay';
            document.body.appendChild(this.overlay);

            // Close on overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });
            
            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
        }
    },

    open(htmlContent) {
        this.init();
        this.overlay.innerHTML = htmlContent;
        // Minor delay to trigger CSS transition
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
            const firstInput = this.overlay.querySelector('input');
            if (firstInput) firstInput.focus();
        });
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                this.overlay.innerHTML = '';
            }, 200); // Wait for transition
        }
    }
};

// ── 2. Rich Text Editor ──────────────────────────────────────
const richTextAreas = document.querySelectorAll('textarea.rich-text-editor');

richTextAreas.forEach(textarea => {
    textarea.style.display = 'none';
    
    const container = document.createElement('div');
    container.className = 'rte-container';
    
    const toolbar = document.createElement('div');
    toolbar.className = 'rte-toolbar';
    
    // Save selection bounds to restore after modal
    let savedRange = null;

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            savedRange = sel.getRangeAt(0);
        }
    };

    const restoreSelection = () => {
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    };

    const buttons = [
        { command: 'bold', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>', title: 'Bold (Ctrl+B)' },
        { command: 'italic', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>', title: 'Italic (Ctrl+I)' },
        { command: 'underline', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>', title: 'Underline (Ctrl+U)' },
        { type: 'separator' },
        { command: 'insertUnorderedList', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', title: 'Bullet List' },
        { command: 'insertOrderedList', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>', title: 'Numbered List' },
        { type: 'separator' },
        { command: 'customLink', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>', title: 'Insert Link' },
        { command: 'customImage', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', title: 'Insert Image from Library' },
        { type: 'separator' },
        { command: 'removeFormat', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="20" y2="20"/><path d="M14.5 9H19m-4.5 0v3.5M9.5 9H5m4.5 0v10m0 0H7.5m2 0H12"/></svg>', title: 'Clear Formatting' }
    ];
    
    buttons.forEach(btnConfig => {
        if (btnConfig.type === 'separator') {
            const sep = document.createElement('div');
            sep.className = 'rte-separator';
            toolbar.appendChild(sep);
            return;
        }
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rte-btn';
        btn.innerHTML = btnConfig.icon;
        btn.title = btnConfig.title;
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            content.focus();
            saveSelection();

            // ── Custom Link Modal ──────────────────────────────
            if (btnConfig.command === 'customLink') {
                ModalManager.open(`
                    <div class="rte-modal">
                        <div class="rte-modal-head">
                            <span>Insert Link</span>
                            <button class="rte-modal-close" id="rte-link-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        </div>
                        <div class="rte-modal-body">
                            <div class="rte-form-group">
                                <label>URL</label>
                                <input type="text" id="rte-link-url" placeholder="https://..." autocomplete="off">
                            </div>
                            <label class="rte-checkbox-label">
                                <input type="checkbox" id="rte-link-target" checked> Open in new tab
                            </label>
                        </div>
                        <div class="rte-modal-foot">
                            <button class="btn btn-ghost btn-sm" id="rte-link-cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" id="rte-link-apply">Apply Link</button>
                        </div>
                    </div>
                `);

                const closeBtn = document.getElementById('rte-link-close');
                const cancelBtn = document.getElementById('rte-link-cancel');
                const applyBtn = document.getElementById('rte-link-apply');
                const urlInput = document.getElementById('rte-link-url');
                const targetCheckbox = document.getElementById('rte-link-target');

                const cleanup = () => ModalManager.close();

                closeBtn.onclick = cleanup;
                cancelBtn.onclick = cleanup;

                applyBtn.onclick = () => {
                    const url = urlInput.value.trim();
                    if (url) {
                        restoreSelection();
                        // Insert link dummy first
                        document.execCommand('createLink', false, url);
                        // Find the newly inserted link to attach target="_blank"
                        const selection = window.getSelection();
                        const anchor = selection.anchorNode.parentNode;
                        if (anchor && anchor.tagName === 'A' && targetCheckbox.checked) {
                            anchor.setAttribute('target', '_blank');
                            anchor.setAttribute('rel', 'noopener noreferrer');
                        }
                        syncContent();
                    }
                    cleanup();
                };
                return;
            }

            // ── Custom Image Modal (Media Library) ──────────────
            if (btnConfig.command === 'customImage') {
                ModalManager.open(`
                    <div class="rte-modal media-modal">
                        <div class="rte-modal-head">
                            <span>Media Library</span>
                            <div style="display:flex;gap:12px;align-items:center;">
                                <a href="/admin/media" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--brand-400);text-decoration:none;font-weight:500;">Upload New</a>
                                <button type="button" id="rte-img-refresh" style="background:none;border:none;color:var(--text-muted);cursor:pointer;display:flex;padding:4px;" title="Refresh Library">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                </button>
                                <button class="rte-modal-close" id="rte-img-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                            </div>
                        </div>
                        <div class="rte-modal-body" id="rte-media-body"></div>
                        <div class="rte-modal-foot">
                            <button class="btn btn-ghost btn-sm" id="rte-img-cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" id="rte-img-apply" disabled>Insert Image</button>
                        </div>
                    </div>
                    <style>
                        .spin { animation: rte-spin 1s linear infinite; }
                        @keyframes rte-spin { 100% { transform: rotate(360deg); } }
                    </style>
                `);

                const closeBtn = document.getElementById('rte-img-close');
                const cancelBtn = document.getElementById('rte-img-cancel');
                const applyBtn = document.getElementById('rte-img-apply');
                const refreshBtn = document.getElementById('rte-img-refresh');
                const bodyEl = document.getElementById('rte-media-body');

                let selectedUrl = null;

                const cleanup = () => ModalManager.close();
                closeBtn.onclick = cleanup;
                cancelBtn.onclick = cleanup;

                const loadMedia = () => {
                    bodyEl.innerHTML = `
                        <div class="rte-media-loader">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                            Loading Media...
                        </div>
                    `;
                    applyBtn.disabled = true;
                    selectedUrl = null;
                    
                    fetch('/admin/api/media')
                        .then(r => r.json())
                        .then(data => {
                            if (!data.items || data.items.length === 0) {
                                bodyEl.innerHTML = `
                                    <div style="display:flex;flex-direction:column;align-items:center;padding:40px;gap:16px;">
                                        <div style="color:var(--text-muted);text-align:center;">No images found in Media Library.</div>
                                        <a href="/admin/media" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="text-decoration:none;">Upload New Image</a>
                                    </div>
                                `;
                                return;
                            }

                            const grid = document.createElement('div');
                            grid.className = 'rte-media-grid';

                            data.items.filter(item => item.mime_type.startsWith('image/')).forEach(item => {
                                const wrapper = document.createElement('div');
                                wrapper.className = 'rte-media-item';
                                wrapper.title = item.title;
                                wrapper.innerHTML = `<img src="${item.thumb}" alt="${item.title}">`;

                                wrapper.onclick = () => {
                                    document.querySelectorAll('.rte-media-item').forEach(el => el.classList.remove('selected'));
                                    wrapper.classList.add('selected');
                                    selectedUrl = item.url;
                                    applyBtn.disabled = false;
                                };

                                grid.appendChild(wrapper);
                            });

                            bodyEl.innerHTML = '';
                            bodyEl.appendChild(grid);
                        })
                        .catch(err => {
                            bodyEl.innerHTML = '<div style="color:var(--error);text-align:center;">Failed to load media.</div>';
                        });
                };

                refreshBtn.onclick = loadMedia;
                loadMedia();

                applyBtn.onclick = () => {
                    if (selectedUrl) {
                        restoreSelection();
                        document.execCommand('insertImage', false, selectedUrl);
                        syncContent();
                    }
                    cleanup();
                };
                return;
            }

            // Fallback for standard commands
            document.execCommand(btnConfig.command, false, null);
            updateToolbarState();
            syncContent();
        });
        
        btn.dataset.command = btnConfig.command;
        toolbar.appendChild(btn);
    });
    
    const content = document.createElement('div');
    content.className = 'rte-content';
    content.contentEditable = true;
    content.innerHTML = textarea.value;
    
    if (textarea.placeholder) {
        content.dataset.placeholder = textarea.placeholder;
    }

    container.appendChild(toolbar);
    container.appendChild(content);
    textarea.parentNode.insertBefore(container, textarea.nextSibling);
    
    const syncContent = () => {
         textarea.value = content.innerHTML;
    };
    
    content.addEventListener('input', syncContent);
    content.addEventListener('blur', syncContent);
    
    const updateToolbarState = () => {
        const btnList = toolbar.querySelectorAll('.rte-btn');
        btnList.forEach(b => {
            if (b.dataset.command && ['bold', 'italic', 'underline'].includes(b.dataset.command)) {
                if (document.queryCommandState(b.dataset.command)) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            }
        });
    };
    
    content.addEventListener('keyup', updateToolbarState);
    content.addEventListener('click', updateToolbarState);
});

// ── 4. Image Resizer Overlay ──────────────────────────────────────
const ImageResizer = {
    resizer: null,
    activeImage: null,
    startX: 0, startWidth: 0,
    dragDir: '',

    init() {
        this.resizer = document.createElement('div');
        this.resizer.className = 'rte-resizer';
        this.resizer.innerHTML = `
            <div class="rte-resizer-handle nw" data-dir="nw"></div>
            <div class="rte-resizer-handle ne" data-dir="ne"></div>
            <div class="rte-resizer-handle sw" data-dir="sw"></div>
            <div class="rte-resizer-handle se" data-dir="se"></div>
        `;

        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'IMG' && e.target.closest('.rte-content')) {
                this.activeImage = e.target;
                const container = this.activeImage.closest('.rte-content');
                if (getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
                container.appendChild(this.resizer);
                this.updatePosition();
            } else if (!e.target.closest('.rte-resizer')) {
                this.hide();
            }
        });

        // Ensure we update position if container scrolls
        document.addEventListener('scroll', (e) => {
            if (e.target.classList && e.target.classList.contains('rte-content')) {
                this.updatePosition();
            }
        }, true);

        this.resizer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('rte-resizer-handle')) {
                e.preventDefault();
                e.stopPropagation();
                this.dragDir = e.target.dataset.dir;
                this.startX = e.clientX;
                this.startWidth = this.activeImage.offsetWidth;
                
                const onMouseMove = (ev) => {
                    const dx = ev.clientX - this.startX;
                    let newWidth = this.startWidth;
                    
                    if (this.dragDir === 'se' || this.dragDir === 'ne') newWidth = this.startWidth + dx;
                    if (this.dragDir === 'sw' || this.dragDir === 'nw') newWidth = this.startWidth - dx;
                    
                    if (newWidth > 30) {
                        this.activeImage.style.width = newWidth + 'px';
                        this.activeImage.style.height = 'auto';
                        this.updatePosition();
                    }
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    // Sync the textarea 
                    if (this.activeImage) {
                        const evt = new Event('input');
                        this.activeImage.closest('.rte-content').dispatchEvent(evt);
                    }
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });
    },

    updatePosition() {
        if (!this.activeImage || !this.resizer.parentNode) return;
        const imgRect = this.activeImage.getBoundingClientRect();
        const container = this.activeImage.closest('.rte-content');
        const containerRect = container.getBoundingClientRect();
        
        this.resizer.style.left = (imgRect.left - containerRect.left + container.scrollLeft) + 'px';
        this.resizer.style.top = (imgRect.top - containerRect.top + container.scrollTop) + 'px';
        this.resizer.style.width = imgRect.width + 'px';
        this.resizer.style.height = imgRect.height + 'px';
    },

    hide() {
        if (this.resizer && this.resizer.parentNode) {
            this.resizer.parentNode.removeChild(this.resizer);
        }
        this.activeImage = null;
    }
};

ImageResizer.init();
});
