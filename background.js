'use strict';

// 接收 content script 发来的批量下载请求，调用 downloads API 逐个下载
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'DOWNLOAD_IMAGES') {
    handleDownload(message.urls)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true; // 保持消息通道，等待异步完成
  }
  return false;
});

async function handleDownload(urls) {
  const folder = 'img-download/';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let success = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    try {
      const ext = (url.match(/\.(jpe?g|png|webp|gif|bmp|avif)/i) || [])[1] || 'jpg';
      const filename = `${folder}${stamp}_${String(i + 1).padStart(2, '0')}.${ext}`;

      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          { url, filename, saveAs: false, conflictAction: 'uniquify' },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(downloadId);
            }
          }
        );
      });

      success++;
      await sleep(200); // 避免短时间内触发过多下载被浏览器限流
    } catch (e) {
      // 单张失败不中断整体下载
    }
  }

  return { ok: true, success, total: urls.length };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
