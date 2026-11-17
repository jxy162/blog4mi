(() => {
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    if (themeMeta) themeMeta.content = dark ? '#0d120e' : '#f4f6ef';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    });
  };
  syncTheme();
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      syncTheme();
    });
  });

  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const closeMenu = () => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    mobileMenu.hidden = true;
    document.body.classList.remove('menu-open');
  };
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      mobileMenu.hidden = !open;
      document.body.classList.toggle('menu-open', open);
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => { if (window.innerWidth > 960) closeMenu(); });
  }

  const header = document.querySelector('[data-site-header]');
  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-revealed'));
  }

  document.querySelectorAll('.prose pre').forEach((pre) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制';
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = '已复制';
        setTimeout(() => { button.textContent = '复制'; }, 1600);
      } catch {
        button.textContent = '复制失败';
      }
    });
    pre.appendChild(button);
  });

  const progress = document.querySelector('[data-reading-progress] span');
  const articleBody = document.querySelector('[data-article-body]');
  const updateProgress = () => {
    if (!progress || !articleBody) return;
    const rect = articleBody.getBoundingClientRect();
    const total = Math.max(1, rect.height - window.innerHeight * 0.45);
    const value = Math.min(1, Math.max(0, (-rect.top + 100) / total));
    progress.style.width = `${value * 100}%`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });

  const tocLinks = Array.from(document.querySelectorAll('[data-toc] a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const tocObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-18% 0px -70% 0px' });
    tocLinks.forEach((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) tocObserver.observe(target);
    });
  }

  document.querySelector('[data-back-to-top]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const replyTarget = document.querySelector('[data-reply-target]');
  const parentInput = document.querySelector('[data-parent-id]');
  const replyName = document.querySelector('[data-reply-name]');
  const contentInput = document.querySelector('#comment-form textarea[name="content"]');
  document.querySelectorAll('[data-reply]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!replyTarget || !parentInput || !replyName) return;
      parentInput.value = button.dataset.id ?? '';
      replyName.textContent = button.dataset.name ?? '';
      replyTarget.hidden = false;
      document.querySelector('#comment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => contentInput?.focus(), 450);
    });
  });
  document.querySelector('[data-cancel-reply]')?.addEventListener('click', () => {
    if (parentInput) parentInput.value = '';
    if (replyTarget) replyTarget.hidden = true;
  });

  document.querySelectorAll('[data-dismiss-flash]').forEach((button) => {
    button.addEventListener('click', () => button.closest('.flash')?.remove());
  });
})();
