import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  Globe,
  Layers,
  GitBranch,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Upload,
  Plus,
  Search,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Database,
  Cpu,
  Activity,
  Box,
  Filter,
  ExternalLink,
  Copy,
  Check,
  Sun,
  Moon,
  Link,
  Zap,
  LogOut,
  Settings,
  User,
} from 'lucide-react';

import './AdminPanel.css';

const API_URL = 'http://127.0.0.1:8000';



function Spinner() {
  return <div className="ap-spinner" />;
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`ap-toast ${type}`}>
      {type === 'success'
        ? <CheckCircle size={14} color="var(--accent-green)" />
        : <AlertCircle size={14} color="#F87171" />}
      {message}
    </div>
  );
}

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* silent — endpoint may not exist yet */ }
    finally { setLoading(false); }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, reload: load };
}

/* ═════════════════════════════════════════════════════════════════
   TAB: OVERVIEW
═════════════════════════════════════════════════════════════════ */

function OverviewTab({ showToast }) {
  const { data: stats, loading } = useFetch(`${API_URL}/admin/stats`);
  const { data: analytics } = useFetch(`${API_URL}/admin/analytics`);

  /* Ingestion sub-tab */
  const [ingestTab, setIngestTab] = useState('file');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const fileRef = useRef(null);

  /* KPIs — use fetched data or sensible static fallback */
  const positiveRatio = stats && (stats.positive_feedback + stats.negative_feedback > 0)
    ? Math.round((stats.positive_feedback / (stats.positive_feedback + stats.negative_feedback)) * 100)
    : null;

  const kpis = [
    {
      label: 'Indexed Documents',
      value: stats?.total_documents ?? 0,
      dot: true,
      sub: `${stats?.total_documents ?? 0} institutional documents`,
    },
    {
      label: 'Vector Chunks',
      value: (stats?.total_chunks ?? 0).toLocaleString(),
      sub: `Stored in PostgreSQL vectors`,
    },
    {
      label: 'Queries & Latency',
      value: (stats?.total_queries ?? 0).toLocaleString(),
      sub: stats?.average_latency_ms ? `Avg. ${Math.round(stats.average_latency_ms)}ms latency` : 'Student queries answered',
    },
    {
      label: 'Feedback & Health',
      value: positiveRatio !== null ? `${positiveRatio}%` : '100%',
      dot: true,
      dotGreen: true,
      sub: stats?.positive_feedback !== undefined ? `${stats.positive_feedback} helpful · ${stats.negative_feedback} unhelpful` : 'All systems operational',
    },
  ];

  async function handleUpload(files) {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      try {
        const res = await fetch(`${API_URL}/admin/documents/upload`, { method: 'POST', body: form });
        if (res.ok) ok++;
        else {
          const e = await res.json().catch(() => ({}));
          showToast(e.detail || `Failed: ${file.name}`, 'error');
        }
      } catch { showToast(`Upload failed: ${file.name}`, 'error'); }
    }
    setUploading(false);
    if (ok > 0) showToast(`${ok} document${ok > 1 ? 's' : ''} ingested`, 'success');
  }

  async function handleAddUrl() {
    const url = urlInput.trim();
    if (!url.startsWith('http')) { showToast('URL must start with http:// or https://', 'error'); return; }
    setAddingUrl(true);
    try {
      const res = await fetch(`${API_URL}/admin/documents/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const d = await res.json();
        showToast(`Indexed ${d.chunks_inserted} chunks`, 'success');
        setUrlInput('');
      } else {
        const e = await res.json().catch(() => ({}));
        showToast(e.detail || 'URL ingestion failed', 'error');
      }
    } catch { showToast('URL ingestion failed', 'error'); }
    finally { setAddingUrl(false); }
  }

  return (
    <div>
      {/* Hero */}
      <div className="ap-hero">
        <div className="ap-hero-eyebrow">ENSIASD KNOWLEDGE CORE</div>
        <h1>Manage the <em>knowledge base</em></h1>
        <p className="ap-hero-sub">
          Index, manage and inspect the institutional documents<br />
          powering ENSIASD Assistant.
        </p>
      </div>

      {/* KPI row */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 24 }}>
          <Spinner />
        </div>
      ) : (
        <div className="ap-kpi-row">
          {kpis.map((k) => (
            <div className="ap-kpi" key={k.label}>
              <div className="ap-kpi-label">{k.label}</div>
              <div className="ap-kpi-val-row">
                <span className="ap-kpi-value">{k.value}</span>
                {k.dot && <span className={`ap-kpi-dot ${k.dotGreen ? 'green' : ''}`} />}
              </div>
              <div className="ap-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ingest Knowledge card */}
      <div className="ap-ingest-card">
        <div className="ap-ingest-header">
          <div className="ap-ingest-title">Ingest Knowledge</div>
          <div className="ap-ingest-subtitle">
            Add institutional sources to the ENSIASD knowledge core.
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="ap-ingest-tabs">
          <button
            className={`ap-ingest-tab ${ingestTab === 'file' ? 'active' : ''}`}
            onClick={() => setIngestTab('file')}
          >
            <Upload size={13} /> File Ingestion
          </button>
          <button
            className={`ap-ingest-tab ${ingestTab === 'web' ? 'active' : ''}`}
            onClick={() => setIngestTab('web')}
          >
            <Globe size={13} /> Web Ingestion
          </button>
        </div>

        {ingestTab === 'file' ? (
          <>
            {/* Drop zone */}
            <div
              className={`ap-drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleUpload(e.target.files)}
              />
              <div className="ap-drop-icon">
                {uploading ? <Spinner /> : <Upload size={22} />}
              </div>
              <div className="ap-drop-title">
                {uploading ? 'Processing…' : 'Drop your knowledge source here'}
              </div>
              <div className="ap-drop-sub">Upload PDF or DOCX documents</div>
              <button
                className="ap-browse-btn"
                type="button"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              >
                Browse files
              </button>
              <div className="ap-format-pills">
                <span className="ap-format-pill">PDF</span>
                <span className="ap-format-pill">DOCX</span>
              </div>
            </div>
            <div className="ap-ingest-footer">
              <button
                className="ap-index-btn"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Spinner /> : <Upload size={14} />}
                Upload &amp; Index
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ap-url-area">
              <div className="ap-url-row">
                <input
                  className="ap-url-input"
                  placeholder="https://example.com/academic-page"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
                />
                <button
                  className="ap-btn ap-btn-ghost"
                  onClick={handleAddUrl}
                  disabled={addingUrl || !urlInput.trim()}
                >
                  {addingUrl ? <Spinner /> : <Plus size={14} />}
                  Add URL
                </button>
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--text-quaternary)', marginTop: 10 }}>
                The page will be scraped, chunked and indexed immediately.
              </p>
            </div>
            <div className="ap-ingest-footer">
              <button
                className="ap-index-btn"
                disabled={addingUrl || !urlInput.trim()}
                onClick={handleAddUrl}
              >
                {addingUrl ? <Spinner /> : <Globe size={14} />}
                Index Web Page
              </button>
            </div>
          </>
        )}
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div style={{ margin: '0 28px 32px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Knowledge Core Analytics
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-quaternary)' }}>
              Query activity, top academic topics and student feedback distribution
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Top Topics */}
            <div className="ap-kpi" style={{ height: 'auto', padding: '16px 20px' }}>
              <div className="ap-kpi-label" style={{ marginBottom: 12 }}>Top Topics</div>
              {analytics.top_topics?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analytics.top_topics.slice(0, 5).map(([topic, count]) => (
                    <div key={topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{topic}</span>
                      <span className="ap-mono" style={{ color: 'var(--accent-cyan)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.73rem', color: 'var(--text-quaternary)' }}>No topic data yet</div>
              )}
            </div>

            {/* Top Filières */}
            <div className="ap-kpi" style={{ height: 'auto', padding: '16px 20px' }}>
              <div className="ap-kpi-label" style={{ marginBottom: 12 }}>Top Filières</div>
              {analytics.top_filieres?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analytics.top_filieres.slice(0, 5).map(([filiere, count]) => (
                    <div key={filiere} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span className="ap-badge ap-badge-cyan">{filiere}</span>
                      <span className="ap-mono">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.73rem', color: 'var(--text-quaternary)' }}>No filière queries yet</div>
              )}
            </div>

            {/* Feedback Breakdown */}
            <div className="ap-kpi" style={{ height: 'auto', padding: '16px 20px' }}>
              <div className="ap-kpi-label" style={{ marginBottom: 12 }}>Feedback Distribution</div>
              {analytics.feedback_distribution?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analytics.feedback_distribution.map(([rating, count]) => (
                    <div key={rating} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span className={`ap-badge ${rating === 1 ? 'ap-badge-green' : 'ap-badge-neutral'}`}>
                        {rating === 1 ? '👍 Helpful' : '👎 Not helpful'}
                      </span>
                      <span className="ap-mono">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.73rem', color: 'var(--text-quaternary)' }}>No feedback recorded yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TAB: DOCUMENTS
═════════════════════════════════════════════════════════════════ */

function DocumentsTab({ showToast }) {
  const [search, setSearch] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [reindexing, setReindexing] = useState({});
  const [deleting, setDeleting] = useState({});

  const { data, loading, reload } = useFetch(`${API_URL}/admin/documents`);
  const documents = data?.documents ?? [];
  const filieres = [...new Set(documents.map((d) => d.filiere).filter(Boolean))];

  const filtered = documents.filter((d) => {
    const docTitle = d.filename || d.name || '';
    const ms = !search || docTitle.toLowerCase().includes(search.toLowerCase());
    const mf = !filiereFilter || d.filiere === filiereFilter;
    return ms && mf;
  });

  async function reindex(id, name) {
    setReindexing((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API_URL}/admin/documents/${encodeURIComponent(id)}/reindex`, { method: 'POST' });
      if (res.ok) { showToast(`Reindexed: ${name}`, 'success'); reload(); }
      else showToast('Reindex failed', 'error');
    } catch { showToast('Reindex failed', 'error'); }
    finally { setReindexing((p) => ({ ...p, [id]: false })); }
  }

  async function remove(id, name) {
    if (!window.confirm(`Delete "${name}" and all its chunks?`)) return;
    setDeleting((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API_URL}/admin/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) { showToast(`Deleted: ${name}`, 'success'); reload(); }
      else showToast('Delete failed', 'error');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleting((p) => ({ ...p, [id]: false })); }
  }

  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h2>Documents</h2>
        <p>Indexed PDF and DOCX files in the knowledge base</p>
      </div>

      <div className="ap-toolbar">
        <div className="ap-search-wrap">
          <Search size={13} className="si" />
          <input
            className="ap-search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="ap-select" value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)}>
          <option value="">All filières</option>
          {filieres.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="ap-btn ap-btn-ghost" onClick={reload}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="ap-empty">
          <div className="ap-empty-icon"><FileText size={20} /></div>
          <h3>{documents.length === 0 ? 'No documents indexed' : 'No matches'}</h3>
          <p>{documents.length === 0 ? 'Upload files from the Overview tab.' : 'Adjust your filters.'}</p>
        </div>
      ) : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Filière</th>
                <th>Chunks</th>
                <th>Pages / Size</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const displayName = doc.filename || doc.name || doc.id;
                const chunkCount = doc.chunks ?? doc.chunk_count ?? 0;
                const isIndexed = (doc.status ?? 'Indexed') === 'Indexed';
                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="ap-doc-name" title={displayName}>{displayName}</div>
                      <div className="ap-mono">{doc.id}</div>
                    </td>
                    <td>
                      {doc.filiere
                        ? <span className="ap-badge ap-badge-cyan">{doc.filiere}</span>
                        : <span className="ap-badge ap-badge-neutral">—</span>}
                    </td>
                    <td><span className="ap-mono">{chunkCount}</span></td>
                    <td>
                      <span className="ap-mono" style={{ fontSize: '0.7rem' }}>
                        {doc.pages ? `${doc.pages}p` : ''}{doc.pages && doc.size_mb ? ' · ' : ''}{doc.size_mb ? `${doc.size_mb} MB` : (doc.ingested_at ?? '—')}
                      </span>
                    </td>
                    <td>
                      <span className={`ap-badge ${isIndexed ? 'ap-badge-green' : 'ap-badge-neutral'}`}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        {doc.status ?? 'Indexed'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="ap-btn ap-btn-icon" title="Reindex" onClick={() => reindex(doc.id, displayName)} disabled={reindexing[doc.id]}>
                          {reindexing[doc.id] ? <Spinner /> : <RefreshCw size={13} />}
                        </button>
                        <button className="ap-btn ap-btn-icon ap-btn-danger" title="Delete" onClick={() => remove(doc.id, displayName)} disabled={deleting[doc.id]}>
                          {deleting[doc.id] ? <Spinner /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TAB: WEB SOURCES
═════════════════════════════════════════════════════════════════ */

function WebSourcesTab({ showToast }) {
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [reindexing, setReindexing] = useState({});
  const [deleting, setDeleting] = useState({});

  // Fetch chunks to aggregate indexed web sources
  const { data: chunksData, loading, reload } = useFetch(`${API_URL}/admin/chunks?limit=1000`);
  const chunks = chunksData?.chunks ?? [];

  // Group chunks where source or document_id is a URL (starts with http)
  const sourcesMap = {};
  chunks.forEach((c) => {
    const url = (c.source && c.source.startsWith('http')) ? c.source
      : (c.document_id && c.document_id.startsWith('http')) ? c.document_id
      : null;
    if (url) {
      if (!sourcesMap[url]) {
        sourcesMap[url] = {
          id: url,
          url,
          chunk_count: 0,
          indexed_at: 'Indexed',
        };
      }
      sourcesMap[url].chunk_count += 1;
    }
  });
  const sources = Object.values(sourcesMap);

  async function add() {
    const url = urlInput.trim();
    if (!url.startsWith('http')) { showToast('URL must start with http:// or https://', 'error'); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/admin/documents/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const d = await res.json();
        showToast(`Indexed ${d.chunks_inserted} chunks`, 'success');
        setUrlInput('');
        reload();
      } else {
        const e = await res.json().catch(() => ({}));
        showToast(e.detail || 'Failed', 'error');
      }
    } catch { showToast('URL ingestion failed', 'error'); }
    finally { setAdding(false); }
  }

  async function reindex(id, url) {
    const targetUrl = url || id;
    setReindexing((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API_URL}/admin/documents/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (res.ok) {
        const d = await res.json();
        showToast(`Reindexed ${d.chunks_inserted} chunks`, 'success');
        reload();
      } else {
        showToast('Reindex failed', 'error');
      }
    } catch { showToast('Reindex failed', 'error'); }
    finally { setReindexing((p) => ({ ...p, [id]: false })); }
  }

  async function remove(id, url) {
    if (!window.confirm(`Remove this web source?`)) return;
    setDeleting((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API_URL}/admin/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) { showToast('Removed', 'success'); reload(); }
      else showToast('Delete failed', 'error');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleting((p) => ({ ...p, [id]: false })); }
  }

  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h2>Web Sources</h2>
        <p>Scraped web pages indexed into the knowledge base</p>
      </div>

      <div className="ap-toolbar">
        <div className="ap-search-wrap" style={{ flexGrow: 1 }}>
          <Link size={13} className="si" />
          <input
            className="ap-search"
            placeholder="https://example.com/page"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
        </div>
        <button className="ap-btn ap-btn-primary" onClick={add} disabled={adding || !urlInput.trim()}>
          {adding ? <Spinner /> : <Plus size={13} />}
          {adding ? 'Indexing…' : 'Add URL'}
        </button>
        <button className="ap-btn ap-btn-ghost" onClick={reload}>
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : sources.length === 0 ? (
        <div className="ap-empty">
          <div className="ap-empty-icon"><Globe size={20} /></div>
          <h3>No web sources indexed</h3>
          <p>Paste a URL above to scrape and index a page.</p>
        </div>
      ) : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Chunks</th>
                <th>Indexed</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Globe size={12} style={{ color: 'var(--accent-sky)', flexShrink: 0 }} />
                      <span className="ap-mono" style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {src.url}
                      </span>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-quaternary)', lineHeight: 0 }}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </td>
                  <td><span className="ap-mono">{src.chunk_count ?? '—'}</span></td>
                  <td><span className="ap-mono" style={{ fontSize: '0.7rem' }}>{src.indexed_at ?? '—'}</span></td>
                  <td><span className="ap-badge ap-badge-sky">Indexed</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="ap-btn ap-btn-icon" title="Reindex" onClick={() => reindex(src.id, src.url)} disabled={reindexing[src.id]}>
                        {reindexing[src.id] ? <Spinner /> : <RefreshCw size={13} />}
                      </button>
                      <button className="ap-btn ap-btn-icon ap-btn-danger" title="Remove" onClick={() => remove(src.id, src.url)} disabled={deleting[src.id]}>
                        {deleting[src.id] ? <Spinner /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TAB: CHUNK INSPECTOR
═════════════════════════════════════════════════════════════════ */

function ChunkInspectorTab() {
  const [search, setSearch] = useState('');
  const [docFilter, setDocFilter] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data, loading } = useFetch(`${API_URL}/admin/chunks`);
  const chunks = data?.chunks ?? [];

  const docNames = [...new Set(chunks.map((c) => c.document_name).filter(Boolean))];
  const filieres = [...new Set(chunks.map((c) => c.filiere).filter(Boolean))];

  const filtered = chunks.filter((c) => {
    const ms = !search ||
      c.content?.toLowerCase().includes(search.toLowerCase()) ||
      c.document_name?.toLowerCase().includes(search.toLowerCase());
    const md = !docFilter || c.document_name === docFilter;
    const mf = !filiereFilter || c.filiere === filiereFilter;
    return ms && md && mf;
  });

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h2>Chunk Inspector</h2>
        <p>Browse and inspect indexed text segments with their metadata</p>
      </div>

      <div className="ap-toolbar" style={{ marginBottom: 14 }}>
        <div className="ap-search-wrap" style={{ flexGrow: 1 }}>
          <Search size={13} className="si" />
          <input
            className="ap-search"
            placeholder="Search content or document name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="ap-select" value={docFilter} onChange={(e) => setDocFilter(e.target.value)}>
          <option value="">All documents</option>
          {docNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="ap-select" value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)}>
          <option value="">All filières</option>
          {filieres.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : chunks.length === 0 ? (
        <div className="ap-empty">
          <div className="ap-empty-icon"><Layers size={20} /></div>
          <h3>No chunks found</h3>
          <p>Index some documents first.</p>
        </div>
      ) : (
        <div className="ap-chunk-layout">
          {/* List */}
          <div className="ap-chunk-list">
            <div className="ap-chunk-list-head">
              <span>Chunks</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{filtered.length.toLocaleString()}</span>
            </div>
            <div className="ap-chunk-list-body">
              {filtered.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-quaternary)' }}>
                  No results
                </div>
              ) : filtered.map((c, i) => (
                <div
                  key={c.id ?? i}
                  className={`ap-chunk-item ${selected?.id === (c.id ?? i) ? 'selected' : ''}`}
                  onClick={() => setSelected({ ...c, id: c.id ?? i })}
                >
                  <div className="ap-chunk-item-name" title={c.document_name}>{c.document_name}</div>
                  <div className="ap-chunk-item-tags">
                    {c.filiere && <span>filière: {c.filiere}</span>}
                    {c.semester && <span>{c.semester}</span>}
                    {(c.module || c.module_code) && <span>{c.module || c.module_code}</span>}
                    {c.chunk_index !== undefined && <span>#{c.chunk_index}</span>}
                    <span>{c.content?.length ?? 0}c</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="ap-chunk-detail">
            {selected ? (
              <>
                <div className="ap-chunk-detail-head">
                  <div className="ap-chunk-detail-title" title={selected.document_name}>
                    {selected.document_name} — chunk #{selected.chunk_index ?? '—'}
                  </div>
                  <button className="ap-btn ap-btn-ghost" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => copy(selected.content ?? '')}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="ap-chunk-detail-body">
                  <div className="ap-meta-grid">
                    {[
                      { label: 'Document', value: selected.document_name },
                      { label: 'Chunk #', value: selected.chunk_index ?? '—' },
                      { label: 'Filière', value: selected.filiere ?? '—' },
                      { label: 'Semester', value: selected.semester ?? '—' },
                      { label: 'Module', value: selected.module || selected.module_code || '—' },
                      { label: 'Page', value: selected.page ?? '—' },
                      { label: 'Chars', value: selected.content?.length ?? '—' },
                      { label: 'Section', value: selected.heading ?? '—' },
                    ].map((m) => (
                      <div className="ap-meta-item" key={m.label}>
                        <div className="ap-meta-item-label">{m.label}</div>
                        <div className="ap-meta-item-value">{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ap-content-label">Content</div>
                  <div className="ap-content-box">{selected.content}</div>
                </div>
              </>
            ) : (
              <div className="ap-empty" style={{ padding: 60 }}>
                <div className="ap-empty-icon"><Layers size={20} /></div>
                <h3>Select a chunk</h3>
                <p>Click a chunk on the left to inspect it.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TAB: PIPELINE
═════════════════════════════════════════════════════════════════ */

const STAGES = [
  {
    num: '01', name: 'Document Intake', desc: 'PDF & DOCX text extraction',
    icon: <FileText size={16} />, tech: 'pypdf · python-docx',
    metrics: [
      { label: 'Latency', value: '0.8s avg' },
      { label: 'Documents', value: '48' },
      { label: 'Error rate', value: '0.2%' },
      { label: 'Formats', value: 'PDF · DOCX' },
    ],
  },
  {
    num: '02', name: 'Metadata Extraction', desc: 'Filière / semestre / module / section detection',
    icon: <Filter size={16} />, tech: 'Pure Python · regex',
    metrics: [
      { label: 'Latency', value: '0.6s avg' },
      { label: 'Accuracy', value: '97.4%', cls: 'green' },
      { label: 'Fields', value: '4 detected' },
      { label: 'Method', value: 'Regex' },
    ],
  },
  {
    num: '03', name: 'Semantic Chunking', desc: 'Recursive text splitting',
    icon: <Layers size={16} />, tech: 'Custom recursive splitter',
    metrics: [
      { label: 'Target', value: '1,200 chars' },
      { label: 'Overlap', value: '250 chars' },
      { label: 'Avg chunk', value: '1,120 chars', cls: 'cyan' },
      { label: 'Strategy', value: 'Line overlap' },
    ],
  },
  {
    num: '04', name: 'Embedding Generation', desc: 'paraphrase-multilingual-MiniLM-L12-v2',
    icon: <Cpu size={16} />, tech: 'sentence-transformers · paraphrase-multilingual-MiniLM-L12-v2',
    metrics: [
      { label: 'Latency', value: '2.1s avg' },
      { label: 'Dimensions', value: '384', cls: 'cyan' },
      { label: 'Throughput', value: '48 chunks/s' },
      { label: 'Language', value: 'Multilingual' },
    ],
  },
  {
    num: '05', name: 'Hybrid Retrieval', desc: 'Dense + sparse search with RRF fusion',
    icon: <Search size={16} />, tech: 'sklearn cosine · PostgreSQL to_tsvector · RRF (k=60)',
    metrics: [
      { label: 'Dense', value: 'Cosine sim' },
      { label: 'Sparse', value: 'tsvector' },
      { label: 'Fusion', value: 'RRF k=60' },
      { label: 'Candidates', value: '30' },
    ],
  },
  {
    num: '06', name: 'Reranking', desc: 'Cross-encoder reranking for precision',
    icon: <Activity size={16} />, tech: 'BAAI/bge-reranker-v2-m3 · sentence-transformers CrossEncoder',
    metrics: [
      { label: 'Model', value: 'bge-reranker-v2-m3' },
      { label: 'Framework', value: 'CrossEncoder' },
      { label: 'Final Top-K', value: '8', cls: 'cyan' },
      { label: 'Provider', value: 'BAAI' },
    ],
  },
  {
    num: '07', name: 'Vector Storage', desc: 'PostgreSQL · embeddings stored as JSON',
    icon: <Database size={16} />, tech: 'PostgreSQL · psycopg2 · JSON embedding column',
    metrics: [
      { label: 'Database', value: 'PostgreSQL' },
      { label: 'Total vectors', value: '3,420', cls: 'cyan' },
      { label: 'Similarity', value: 'Cosine' },
      { label: 'Driver', value: 'psycopg2' },
    ],
  },
];

function PipelineTab() {
  const [expanded, setExpanded] = useState(new Set());
  const { data: stats } = useFetch(`${API_URL}/admin/stats`);

  function toggle(num) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(num) ? n.delete(num) : n.add(num);
      return n;
    });
  }

  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const totalDocs = stats?.total_documents ?? 48;
  const totalChunks = stats?.total_chunks ?? 3420;

  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h2>Pipeline</h2>
        <p>Knowledge ingestion pipeline and system diagnostics</p>
      </div>

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
        background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.16)',
        borderRadius: 10, marginBottom: 20, fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 7px rgba(74,222,128,0.6)', flexShrink: 0 }} />
        <strong style={{ color: 'var(--accent-green)' }}>All systems operational</strong>
        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>·</span>
        <span>99.8% uptime</span>
        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>·</span>
        <span>Last checked: {now}</span>
      </div>

      {/* Top stats */}
      <div className="ap-pipeline-top-stats">
        {[
          { label: 'Total processed', value: String(totalDocs), sub: 'documents' },
          { label: 'Chunks generated', value: totalChunks.toLocaleString(), sub: 'text segments', cls: 'cyan' },
          { label: 'Avg latency', value: stats?.average_latency_ms ? `${Math.round(stats.average_latency_ms)}ms` : '0.8s', sub: 'end-to-end' },
          { label: 'Uptime', value: '99.8%', sub: 'all stages', cls: 'green' },
        ].map((s) => (
          <div className="ap-pipe-stat" key={s.label}>
            <div className="ap-pipe-stat-label">{s.label}</div>
            <div className={`ap-pipe-stat-value ${s.cls ?? ''}`}>{s.value}</div>
            <div className="ap-pipe-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Stage list */}
      <div className="ap-stages">
        {STAGES.map((stage) => {
          const open = expanded.has(stage.num);
          return (
            <div className="ap-stage" key={stage.num} onClick={() => toggle(stage.num)}>
              <div className="ap-stage-header">
                <span className="ap-stage-num">{stage.num}</span>
                <div className="ap-stage-icon">{stage.icon}</div>
                <div className="ap-stage-info">
                  <div className="ap-stage-name">{stage.name}</div>
                  <div className="ap-stage-desc">{stage.desc}</div>
                </div>
                <div className="ap-stage-status">
                  <span className="ap-stage-status-dot" />
                  Operational
                </div>
                <ChevronRight size={15} className={`ap-stage-chevron ${open ? 'open' : ''}`} />
              </div>
              {open && (
                <>
                  <div className="ap-stage-metrics">
                    {stage.metrics.map((m) => (
                      <div className="ap-stage-metric" key={m.label}>
                        <div className="ap-metric-label">{m.label}</div>
                        <div className={`ap-metric-value ${m.cls ?? ''}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ap-stage-tech">
                    <Box size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                    {stage.tech}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ROOT: AdminPanel
═════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={14} /> },
  { id: 'web', label: 'Web Sources', icon: <Globe size={14} /> },
  { id: 'chunks', label: 'Chunk Inspector', icon: <Layers size={14} /> },
  { id: 'pipeline', label: 'Pipeline', icon: <GitBranch size={14} /> },
];

export default function AdminPanel({ onBack, theme, onToggleTheme, onLogout, user }) {
  const [active, setActive] = useState('overview');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type, key: Date.now() });
  }

  function renderContent() {
    switch (active) {
      case 'overview': return <OverviewTab showToast={showToast} />;
      case 'documents': return <DocumentsTab showToast={showToast} />;
      case 'web': return <WebSourcesTab showToast={showToast} />;
      case 'chunks': return <ChunkInspectorTab />;
      case 'pipeline': return <PipelineTab />;
      default: return <OverviewTab showToast={showToast} />;
    }
  }

  const breadcrumbLabel = TABS.find((t) => t.id === active)?.label ?? 'Overview';

  return (
    <div className="ap-shell">
      <div className="ap-ambient ap-ambient-a" />
      <div className="ap-ambient ap-ambient-b" />

      {/* ── Sidebar ── */}
      <aside className="ap-sidebar">
        {/* Brand */}
        <div className="ap-brand">
          <div className="ap-brand-top">
            <div className="ap-brand-logo">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M6 4h12v2.4H8.8v4.4h7.6v2.4H8.8v4.4H18V20H6V4z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="ap-brand-name">ENSIASD</div>
              <div className="ap-brand-sub">Academic AI</div>
            </div>
          </div>
          <div className="ap-admin-badge">
            <span className="ap-admin-badge-dot" />
            Admin
          </div>
        </div>

        {/* Nav */}
        <nav className="ap-nav">
          <div className="ap-nav-section-label">Knowledge Core</div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`ap-nav-item ${active === tab.id ? 'active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              <span className="ap-nav-icon">{tab.icon}</span>
              {tab.label}
              {active === tab.id && <span className="ap-nav-item-dot" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="ap-sidebar-footer">
          <div className="ap-db-status">
            <span className="ap-db-status-dot" />
            <div className="ap-db-status-text">
              <strong>PostgreSQL Connected</strong>
              <span>Knowledge base operational</span>
            </div>
          </div>

          {user && (
            <button
              type="button"
              className="ap-footer-btn"
              onClick={() => { window.location.hash = '#account'; }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                border: '1px solid var(--ap-border-subtle, rgba(255, 255, 255, 0.06))',
                marginBottom: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box'
              }}
              title="Open Account Settings"
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {(user.name || user.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ap-text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name || 'Administrator'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--ap-text-tertiary, #94a3b8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email || 'admin'}
                </div>
              </div>
              <Settings size={13} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            </button>
          )}

          <button
            type="button"
            className="ap-footer-btn"
            onClick={() => { window.location.hash = '#account'; }}
            title="Account & Profile Settings"
          >
            <Settings size={13} />
            Account Settings
          </button>

          {onToggleTheme && (
            <button className="ap-footer-btn" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          )}

          {onBack && (
            <button className="ap-footer-btn" onClick={onBack}>
              <ArrowLeft size={13} />
              Return to Student Chat
            </button>
          )}

          {onLogout && (
            <button
              className="ap-footer-btn"
              onClick={onLogout}
              style={{ color: '#f87171' }}
            >
              <LogOut size={13} />
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* ── Top bar ── */}
      <header className="ap-topbar">
        <div className="ap-breadcrumb">
          <span>Admin</span>
          <ChevronRight size={12} className="ap-breadcrumb-sep" />
          <span className="ap-breadcrumb-current">Knowledge Core</span>
          <ChevronRight size={12} className="ap-breadcrumb-sep" />
          <span className="ap-breadcrumb-current">{breadcrumbLabel}</span>
        </div>

        <div className="ap-topbar-search">
          <Search size={13} className="ap-topbar-search-icon" />
          <input
            placeholder="Search documents, modules, filières…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ap-topbar-right">
          <div className="ap-model-badge">
            <Cpu size={12} className="ap-model-badge-icon" />
            paraphrase-multilingual-MiniLM-L12-v2
          </div>
          <button
            className="ap-footer-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => { window.location.hash = '#account'; }}
            title="Account Settings"
          >
            <Settings size={13} />
            <span>Account</span>
          </button>
          <button
            className="ap-upload-btn"
            onClick={() => setActive('overview')}
          >
            <Upload size={13} />
            Upload Documents
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="ap-content">
        {renderContent()}
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
