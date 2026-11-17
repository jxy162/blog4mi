(() => {
  const sidebar = document.querySelector('[data-admin-sidebar]');
  const menuButton = document.querySelector('[data-admin-menu]');
  menuButton?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('is-open') ?? false;
    menuButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!sidebar?.classList.contains('is-open')) return;
    if (sidebar.contains(event.target) || menuButton?.contains(event.target)) return;
    sidebar.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });

  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const message = form.getAttribute('data-confirm') || '确定执行这个操作吗？';
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  const form = document.querySelector('[data-editor-form]');
  if (!form) return;
  const content = document.querySelector('[data-content-input]');
  const title = document.querySelector('[data-title-input]');
  const slug = document.querySelector('[data-slug-input]');
  const writePane = document.querySelector('[data-write-pane]');
  const previewPane = document.querySelector('[data-preview-pane]');
  const tabs = document.querySelectorAll('[data-editor-tab]');
  let previewLoaded = false;
  let previewLoading = false;
  let dirty = false;

  const setTab = async (name) => {
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.editorTab === name));
    if (name === 'preview') {
      if (writePane) writePane.hidden = true;
      if (previewPane) previewPane.hidden = false;
      if (!previewLoaded && !previewLoading && previewPane && content) {
        previewLoading = true;
        previewPane.innerHTML = '<div class="preview-placeholder">正在渲染预览…</div>';
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        try {
          const response = await fetch('/admin/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            body: JSON.stringify({ content: content.value }),
          });
          if (!response.ok) throw new Error('Preview failed');
          const data = await response.json();
          previewPane.innerHTML = data.html || '<div class="preview-placeholder">还没有内容。</div>';
          previewLoaded = true;
        } catch {
          previewPane.innerHTML = '<div class="preview-placeholder">预览加载失败，请刷新后重试。</div>';
        } finally {
          previewLoading = false;
        }
      }
    } else {
      if (writePane) writePane.hidden = false;
      if (previewPane) previewPane.hidden = true;
    }
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.editorTab)));

  const insertText = (value, prefix = false) => {
    if (!content) return;
    const start = content.selectionStart;
    const end = content.selectionEnd;
    const selected = content.value.slice(start, end);
    const inserted = prefix ? `${value}${selected}` : value;
    content.setRangeText(inserted, start, end, 'end');
    content.focus();
    content.dispatchEvent(new Event('input', { bubbles: true }));
  };
  document.querySelectorAll('[data-md-insert]').forEach((button) => {
    button.addEventListener('click', () => insertText(button.dataset.mdInsert ?? ''));
  });
  document.querySelectorAll('[data-md-prefix]').forEach((button) => {
    button.addEventListener('click', () => insertText(button.dataset.mdPrefix ?? '', true));
  });

  document.querySelectorAll('[data-tag-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = form.querySelector('input[name="tags"]');
      if (!input) return;
      const tags = input.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
      if (!tags.includes(button.dataset.tagSuggestion)) tags.push(button.dataset.tagSuggestion);
      input.value = tags.join(', ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  title?.addEventListener('input', () => {
    if (!slug || slug.value || slug.dataset.autoEdited === 'true') return;
    slug.placeholder = title.value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  });
  slug?.addEventListener('input', () => { slug.dataset.autoEdited = 'true'; });

  form.addEventListener('input', () => { dirty = true; previewLoaded = false; });
  form.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
