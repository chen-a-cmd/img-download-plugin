(function () {
  'use strict';

  if (window.__IMG_DL_LOADED__) return;
  window.__IMG_DL_LOADED__ = true;

  const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif)(?:[?#]|$)/i;
  const EXCLUDE_RE = /(avatar|logo|icon|btn|button|share|qrcode|qr_|loading|spinner|placeholder|sprite|blank|arrow|close|emoji|pixel|error|face_)/i;

  const $ = (id) => document.getElementById(id);

  function cleanUrl(u) {
    if (typeof u !== 'string') return null;
    u = u.trim();
    if (!u) return null;
    if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:/i.test(u)) return null;
    return u;
  }

  function isImageUrl(u) {
    return IMG_EXT_RE.test(u);
  }

  function baseOf(u) {
    return u.split(/[?#]/)[0];
  }

  // 去掉阿里 CDN 的缩略图尺寸后缀，还原原图（例如 xxx.jpg_50x50.jpg -> xxx.jpg）
  function toFullRes(u) {
    return u.replace(/(\.(?:jpe?g|png|webp|gif))_[^/]*$/i, '$1');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function extractImages() {
    const map = new Map();

    const add = (raw, thumb, w, h) => {
      const url = cleanUrl(raw);
      if (!url || !isImageUrl(url)) return;
      if (EXCLUDE_RE.test(url)) return;
      const full = toFullRes(url);
      const key = baseOf(full);
      const size = (w || 0) * (h || 0);
      const prev = map.get(key);
      if (!prev || size > (prev.w || 0) * (prev.h || 0)) {
        map.set(key, {
          url: full,
          thumb: cleanUrl(thumb) || url,
          w: w || 0,
          h: h || 0
        });
      }
    };

    // 遍历所有 <img>，兼容懒加载
    document.querySelectorAll('img').forEach((img) => {
      const w = img.naturalWidth || img.clientWidth || img.width || 0;
      const h = img.naturalHeight || img.clientHeight || img.height || 0;
      if ((w > 0 && w < 50) || (h > 0 && h < 50)) return;

      const srcs = [
        img.currentSrc,
        img.src,
        img.getAttribute('data-src'),
        img.getAttribute('data-ks-lazyload'),
        img.getAttribute('data-lazyload'),
        img.getAttribute('data-original'),
        img.getAttribute('data-echo'),
        img.getAttribute('data-hi-res'),
        img.getAttribute('data-large')
      ];

      const thumb = srcs.find((s) => cleanUrl(s)) || srcs[0];
      srcs.forEach((s) => { if (s) add(s, thumb, w, h); });
    });

    // 遍历背景图
    document.querySelectorAll('div, a, span, li, figure, section').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none') return;
      const m = bg.match(/url\(["']?(.*?)["']?\)/);
      if (m && m[1]) add(m[1], m[1], 0, 0);
    });

    return Array.from(map.values()).sort((a, b) => (b.w * b.h) - (a.w * a.h));
  }

  function formatSize(w, h) {
    return (w && h) ? `${w}×${h}` : '';
  }

  // ---------- UI ----------
  let images = [];
  let selected = new Set();
  let open = false;

  function ensureUI() {
    if ($('img-dl-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'img-dl-fab';
    fab.type = 'button';
    fab.title = '下载商品图片';
    fab.textContent = '下载';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'img-dl-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="idp-header">
        <span class="idp-title">商品图片</span>
        <span class="idp-count" id="idp-count"></span>
        <div class="idp-actions">
          <label class="idp-select-all"><input type="checkbox" id="idp-check-all" checked />全选</label>
          <button class="idp-close" id="idp-close" type="button" title="关闭">×</button>
        </div>
      </div>
      <div class="idp-body" id="idp-body"></div>
      <div class="idp-footer">
        <button class="idp-download" id="idp-download" type="button">下载选中图片</button>
      </div>
    `;
    document.body.appendChild(panel);

    fab.addEventListener('click', () => togglePanel());
    $('idp-close').addEventListener('click', () => togglePanel(false));
    $('idp-check-all').addEventListener('change', (e) => {
      selected = e.target.checked ? new Set(images.map((_, i) => i)) : new Set();
      updateCount();
      syncChecks();
    });
    $('idp-download').addEventListener('click', downloadSelected);

    $('idp-body').addEventListener('change', (e) => {
      if (e.target && e.target.matches('input[type="checkbox"]')) {
        const idx = Number(e.target.dataset.idx);
        if (e.target.checked) selected.add(idx);
        else selected.delete(idx);
        updateCount();
        $('idp-check-all').checked = selected.size === images.length;
      }
    });
  }

  function togglePanel(force) {
    open = typeof force === 'boolean' ? force : !open;
    const panel = $('img-dl-panel');
    if (!panel) return;
    panel.style.display = open ? 'flex' : 'none';
    if (open) refresh();
  }

  function refresh() {
    images = extractImages();
    selected = new Set(images.map((_, i) => i));
    $('idp-check-all').checked = true;
    renderList();
    updateCount();
  }

  function renderList() {
    const body = $('idp-body');
    if (!body) return;
    body.innerHTML = '';
    if (!images.length) {
      body.innerHTML = '<div class="idp-empty">未找到商品图片，请确认已打开商品详情页。</div>';
      return;
    }
    images.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'idp-item';
      card.innerHTML = `
        <div class="idp-thumb-wrap">
          <img src="${escapeHtml(item.thumb)}" loading="lazy" referrerpolicy="no-referrer" />
          <label class="idp-check"><input type="checkbox" data-idx="${idx}" ${selected.has(idx) ? 'checked' : ''} /></label>
        </div>
        <div class="idp-size">${formatSize(item.w, item.h)}</div>
      `;
      body.appendChild(card);
    });
  }

  function syncChecks() {
    document.querySelectorAll('#idp-body input[type="checkbox"]').forEach((cb) => {
      cb.checked = selected.has(Number(cb.dataset.idx));
    });
  }

  function updateCount() {
    const el = $('idp-count');
    if (el) el.textContent = `${selected.size} / ${images.length}`;
  }

  function downloadSelected() {
    const urls = images.filter((_, i) => selected.has(i)).map((it) => it.url);
    if (!urls.length) {
      showToast('请先选择要下载的图片');
      return;
    }
    setDownloading(true);
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_IMAGES', urls }, (resp) => {
      setDownloading(false);
      if (chrome.runtime.lastError) {
        showToast('下载失败：' + chrome.runtime.lastError.message);
        return;
      }
      if (resp && resp.ok) {
        showToast(`已开始下载 ${resp.success} / ${urls.length} 张图片`);
      } else {
        showToast('下载失败：' + ((resp && resp.error) || '未知错误'));
      }
    });
  }

  function setDownloading(flag) {
    const btn = $('idp-download');
    if (btn) {
      btn.disabled = flag;
      btn.textContent = flag ? '下载中…' : '下载选中图片';
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    let t = $('idp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'idp-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
  }

  function init() {
    ensureUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
