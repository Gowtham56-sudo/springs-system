"""Local uploader dashboard HTML."""

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Wedding Photo Uploader</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #faf8f5;
      color: #2c2c2c;
      min-height: 100vh;
      padding: 24px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    h1 {
      font-family: Georgia, serif;
      font-size: 1.5rem;
      text-align: center;
      margin-bottom: 8px;
      color: #c9a962;
    }
    .subtitle { text-align: center; color: #888; font-size: 0.85rem; margin-bottom: 24px; }
    .card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .card h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 12px; }
    .stat-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.95rem; }
    .stat-row .value { font-weight: 600; }
    .progress-bar {
      height: 8px;
      background: #f0ebe3;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(135deg, #c9a962, #a88b4a);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    .status-connected { color: #22c55e; font-weight: 600; }
    .status-disconnected { color: #ef4444; font-weight: 600; }
    .buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    button {
      flex: 1;
      min-width: 120px;
      padding: 12px 16px;
      border: none;
      border-radius: 999px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.85; }
    .btn-primary { background: linear-gradient(135deg, #c9a962, #a88b4a); color: white; }
    .btn-secondary { background: white; border: 2px solid #c9a962; color: #c9a962; }
    .current-file { font-size: 0.85rem; color: #666; margin-top: 8px; }
    .divider { border: none; border-top: 1px solid #f0ebe3; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI Wedding Photo Uploader</h1>
    <p class="subtitle">Automatic upload &amp; AI face indexing</p>

    <div class="card">
      <h2>Wedding</h2>
      <div class="stat-row"><span>Wedding ID</span><span class="value" id="weddingCode">—</span></div>
      <div class="stat-row"><span>Folder</span><span class="value" id="folder" style="font-size:0.8rem">—</span></div>
      <div class="stat-row"><span>Google Drive</span><span id="driveStatus">—</span></div>
    </div>

    <div class="card">
      <h2>Statistics</h2>
      <div class="stat-row"><span>Total Photos</span><span class="value" id="total">0</span></div>
      <div class="stat-row"><span>Uploaded</span><span class="value" id="uploaded">0</span></div>
      <div class="stat-row"><span>AI Processed</span><span class="value" id="completed">0</span></div>
      <div class="stat-row"><span>Processing</span><span class="value" id="processing">0</span></div>
      <div class="stat-row"><span>Failed</span><span class="value" id="failed">0</span></div>
      <hr class="divider">
      <div class="current-file">Current: <span id="currentFile">—</span></div>
      <p style="font-size:0.75rem;color:#999;margin-top:4px">Upload:</p>
      <div class="progress-bar"><div class="progress-fill" id="uploadProgress" style="width:0%"></div></div>
    </div>

    <div class="buttons">
      <button class="btn-secondary" id="pauseBtn" onclick="togglePause()">Pause</button>
      <button class="btn-secondary" id="retryBtn" onclick="retryFailed()">Retry Failed</button>
      <button class="btn-primary" id="folderBtn" onclick="openFolder()">Open Folder</button>
      <button class="btn-primary" id="changeFolderBtn" onclick="changeFolder()">Change Folder</button>
    </div>
    <div class="buttons" style="margin-top: 8px;">
      <button class="btn-secondary" style="border-color: #ef4444; color: #ef4444;" onclick="clearQueue()">Clear Local Queue</button>
      <button class="btn-secondary" style="border-color: #ef4444; color: #ef4444;" onclick="clearDrive()">Clear Drive Photos</button>
    </div>
  </div>

  <script>
    let paused = false;

    async function refresh() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        document.getElementById('weddingCode').textContent = data.weddingCode || '—';
        document.getElementById('folder').textContent = data.watchFolder || '—';

        const driveEl = document.getElementById('driveStatus');
        if (data.driveConnected) {
          driveEl.textContent = 'CONNECTED';
          driveEl.className = 'status-connected';
        } else {
          driveEl.textContent = 'DISCONNECTED';
          driveEl.className = 'status-disconnected';
        }

        const stats = data.stats || {};
        document.getElementById('total').textContent = stats.total || 0;
        document.getElementById('uploaded').textContent =
          (stats.completed || 0) + (stats.processing || 0) + (stats.uploaded || 0);
        document.getElementById('completed').textContent = stats.completed || 0;
        document.getElementById('processing').textContent =
          (stats.processing || 0) + (stats.uploading || 0);
        document.getElementById('failed').textContent = stats.failed || 0;

        const current = stats.current || {};
        document.getElementById('currentFile').textContent = current.fileName || '—';
        const progress = Math.round((current.progress || 0) * 100);
        document.getElementById('uploadProgress').style.width = progress + '%';

        paused = data.paused || false;
        document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
      } catch (e) {
        console.error('Refresh failed', e);
      }
    }

    async function togglePause() {
      const endpoint = paused ? '/api/resume' : '/api/pause';
      await fetch(endpoint, { method: 'POST' });
      refresh();
    }

    async function retryFailed() {
      await fetch('/api/retry-failed', { method: 'POST' });
      refresh();
    }

    function openFolder() {
      fetch('/api/open-folder', { method: 'POST' });
    }

    async function changeFolder() {
      await fetch('/api/change-folder', { method: 'POST' });
      refresh();
    }

    async function clearQueue() {
      if (confirm('Are you sure you want to clear the local upload queue? This will stop pending uploads.')) {
        await fetch('/api/clear-queue', { method: 'POST' });
        refresh();
      }
    }

    async function clearDrive() {
      if (confirm('Are you sure you want to delete all photos for this wedding from Google Drive? This action cannot be undone!')) {
        alert('Clearing drive photos... this might take a few moments.');
        await fetch('/api/clear-drive', { method: 'POST' });
        alert('Drive photos cleared successfully.');
        refresh();
      }
    }

    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>"""
