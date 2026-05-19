import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";

// ─── Global API Key Store (runtime, no env needed) ────────────────────────────
const apiKeys = { gemini: "", openrouter: "", nvd: "", tursoUrl: "", tursoToken: "" };

// ─── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_META = {
  CRITICAL: { label:"Critical", color:"#ff2d55", glow:"rgba(255,45,85,0.45)", bg:"rgba(255,45,85,0.09)" },
  HIGH:     { label:"High",     color:"#ff6b00", glow:"rgba(255,107,0,0.38)", bg:"rgba(255,107,0,0.09)" },
  MEDIUM:   { label:"Medium",   color:"#f59e0b", glow:"rgba(245,158,11,0.32)",bg:"rgba(245,158,11,0.08)"},
  LOW:      { label:"Low",      color:"#22d3ee", glow:"rgba(34,211,238,0.28)",bg:"rgba(34,211,238,0.07)"},
  SAFE:     { label:"Safe",     color:"#10b981", glow:"rgba(16,185,129,0.28)",bg:"rgba(16,185,129,0.07)"},
};
const ECOSYSTEM_META = {
  npm:    { label:"npm",   color:"#cb3837" },
  pypi:   { label:"PyPI",  color:"#3776ab" },
  maven:  { label:"Maven", color:"#c71a36" },
  cargo:  { label:"Cargo", color:"#ce422b" },
  go:     { label:"Go",    color:"#00add8" },
  nuget:  { label:"NuGet", color:"#004880" },
  unknown:{ label:"?",     color:"#64748b" },
};
const SEVERITY_ORDER = ["CRITICAL","HIGH","MEDIUM","LOW","SAFE"];
const OSV_ECO_MAP = { npm:"npm",pypi:"PyPI",maven:"Maven",cargo:"crates.io",go:"Go",nuget:"NuGet",hex:"Hex",gem:"RubyGems",pub:"Pub",unknown:"npm" };

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800;900&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#04060f;--surface:#090e1a;--surface2:#0f1625;--surface3:#141e2e;
  --border:rgba(255,255,255,0.055);--border-bright:rgba(255,255,255,0.11);
  --text:#e2e8f0;--text-muted:#64748b;--text-dim:#2d3f55;
  --accent:#7c3aed;--accent2:#06b6d4;--accent3:#ff2d55;
  --font-d:'Syne',sans-serif;--font-m:'JetBrains Mono',monospace;
}
/* FIX: allow page scroll — only the graph canvas is overflow:hidden */
html,body,#root{height:100%;min-height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--font-d);overflow-x:hidden;overflow-y:auto}

::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
@keyframes bgFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-22px) rotate(4deg)}}
@keyframes scanline{0%{top:-5%}100%{top:108%}}
@keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes edgePulse{0%{opacity:.25}50%{opacity:.9}100%{opacity:.25}}
@keyframes nodeIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}

/* App shell: full viewport height, scrollable */
.app{display:flex;flex-direction:column;height:100dvh;background:var(--bg);position:relative;overflow:hidden}

/* Onboarding — allow scroll on small screens */
.onboard{display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:2rem;position:relative;overflow:hidden}
.onboard-bg{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.13;animation:bgFloat 9s ease-in-out infinite}
.blob-1{width:560px;height:560px;background:radial-gradient(circle,#7c3aed,transparent);top:-120px;left:-120px;animation-delay:0s}
.blob-2{width:440px;height:440px;background:radial-gradient(circle,#06b6d4,transparent);bottom:-90px;right:-90px;animation-delay:-3.5s}
.blob-3{width:320px;height:320px;background:radial-gradient(circle,#ff2d55,transparent);top:35%;right:18%;animation-delay:-7s}
.blob-4{width:250px;height:250px;background:radial-gradient(circle,#f59e0b,transparent);bottom:25%;left:15%;animation-delay:-4s;opacity:.07}
.grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px);background-size:42px 42px}
.scanline{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(124,58,237,0.4),rgba(6,182,212,0.3),transparent);animation:scanline 7s linear infinite;pointer-events:none}

.onboard-inner{position:relative;z-index:1;width:100%;max-width:700px;display:flex;flex-direction:column;align-items:center;gap:2.25rem;animation:fadeUp .7s ease;padding-bottom:2rem}

.logo-mark{display:flex;align-items:center;gap:.8rem}
.logo-hex{width:42px;height:42px;flex-shrink:0}
.logo-wordmark{font-family:var(--font-d);font-weight:900;font-size:1rem;letter-spacing:-.03em;color:#fff}
.logo-wordmark span{color:var(--accent)}

.hero-headline{text-align:center}
.hero-headline h1{font-family:var(--font-d);font-weight:900;font-size:clamp(1.9rem,5vw,3.1rem);letter-spacing:-.04em;line-height:1.08;color:#fff}
.hero-headline h1 em{font-style:normal;background:linear-gradient(135deg,#7c3aed,#06b6d4 40%,#ff2d55 80%);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradShift 4s ease infinite}
.hero-headline p{margin-top:.7rem;color:var(--text-muted);font-size:.82rem;font-family:var(--font-m);font-weight:300;letter-spacing:.01em}

.upload-zone{width:100%;border:1.5px dashed rgba(124,58,237,0.38);border-radius:18px;padding:2.75rem 2rem;display:flex;flex-direction:column;align-items:center;gap:1rem;cursor:pointer;transition:all .3s ease;background:rgba(124,58,237,0.035);position:relative;overflow:hidden}
.upload-zone::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(124,58,237,0.055) 0%,transparent 68%);pointer-events:none}
.upload-zone:hover,.upload-zone.dragging{border-color:rgba(124,58,237,.85);background:rgba(124,58,237,.07);box-shadow:0 0 50px rgba(124,58,237,.15),inset 0 0 30px rgba(124,58,237,.04)}
.upload-zone.dragging{transform:scale(1.015)}
.upload-icon{color:#7c3aed;opacity:.85;transition:transform .3s}
.upload-zone:hover .upload-icon{transform:translateY(-3px) scale(1.05)}
.upload-label{font-family:var(--font-d);font-weight:700;font-size:1.08rem;color:var(--text)}
.upload-sub{font-family:var(--font-m);font-size:.73rem;color:var(--text-muted)}
.upload-formats{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:center;margin-top:.25rem}
.fmt-badge{padding:.22rem .58rem;border-radius:6px;background:rgba(255,255,255,0.045);border:1px solid var(--border);font-family:var(--font-m);font-size:.65rem;color:var(--text-muted);letter-spacing:.02em}

.progress-bar{height:2px;border-radius:2px;background:rgba(255,255,255,0.055);overflow:hidden;width:320px}
.progress-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#06b6d4);border-radius:2px;transition:width .3s ease}
.progress-label{display:flex;justify-content:space-between;margin-top:.45rem;font-family:var(--font-m);font-size:.68rem;color:var(--text-muted)}

.or-divider{display:flex;align-items:center;gap:1rem;width:100%}
.or-line{flex:1;height:1px;background:var(--border)}
.or-text{font-family:var(--font-m);font-size:.68rem;color:var(--text-dim);letter-spacing:.04em}

.demo-btns{display:flex;gap:.65rem;flex-wrap:wrap;justify-content:center}
.demo-btn{padding:.7rem 1.5rem;border-radius:10px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;font-family:var(--font-d);font-weight:600;font-size:.85rem;cursor:pointer;transition:all .22s ease;letter-spacing:-.01em}
.demo-btn:hover{background:rgba(124,58,237,.22);border-color:rgba(124,58,237,.65);box-shadow:0 0 22px rgba(124,58,237,.2);transform:translateY(-1px)}

.spinner{width:44px;height:44px;border:2px solid rgba(124,58,237,0.13);border-top-color:#7c3aed;border-radius:50%;animation:spin .75s linear infinite}
.load-step{font-family:var(--font-m);font-size:.65rem;color:var(--text-dim);display:flex;align-items:center;gap:.45rem;animation:fadeUp .35s ease}
.load-step.done{color:#10b981}
.load-dot{width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0}

/* Settings modal */
.modal-overlay{position:fixed;inset:0;background:rgba(4,6,15,.85);backdrop-filter:blur(12px);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease;padding:1rem}
.modal{background:var(--surface);border:1px solid var(--border-bright);border-radius:18px;width:min(560px,95vw);max-height:90vh;overflow-y:auto;animation:fadeUp .25s ease;position:relative}
.modal-header{padding:1.4rem 1.5rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.modal-title{font-family:var(--font-d);font-weight:800;font-size:1rem;color:#fff;letter-spacing:-.02em}
.modal-body{padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1.1rem}
.modal-footer{padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:.6rem;justify-content:flex-end}

.field-group{display:flex;flex-direction:column;gap:.4rem}
.field-label{font-family:var(--font-m);font-size:.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em}
.field-desc{font-family:var(--font-m);font-size:.62rem;color:var(--text-dim);line-height:1.5;margin-top:.2rem}
.field-input{width:100%;padding:.6rem .75rem;background:var(--surface2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--font-m);font-size:.75rem;outline:none;transition:border-color .2s}
.field-input:focus{border-color:rgba(124,58,237,.55);box-shadow:0 0 0 3px rgba(124,58,237,.08)}
.field-input::placeholder{color:var(--text-dim)}
.field-section{font-family:var(--font-d);font-weight:700;font-size:.78rem;color:var(--text);padding:.6rem 0 .3rem;border-bottom:1px solid var(--border);margin-bottom:.3rem}
.provider-tabs{display:flex;gap:.4rem;margin-bottom:.8rem}
.provider-tab{flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);font-family:var(--font-m);font-size:.68rem;cursor:pointer;text-align:center;transition:all .2s}
.provider-tab.active{border-color:rgba(124,58,237,.5);background:rgba(124,58,237,.12);color:#a78bfa}

.btn-primary{padding:.55rem 1.2rem;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#6025c0);border:none;color:#fff;font-family:var(--font-d);font-weight:700;font-size:.82rem;cursor:pointer;transition:all .2s;letter-spacing:-.01em}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(124,58,237,.4)}
.btn-ghost{padding:.55rem 1rem;border-radius:9px;background:transparent;border:1px solid var(--border);color:var(--text-muted);font-family:var(--font-d);font-weight:600;font-size:.82rem;cursor:pointer;transition:all .2s}
.btn-ghost:hover{border-color:var(--border-bright);color:var(--text)}
.btn-close{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.06);border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.btn-close:hover{background:rgba(255,255,255,.1);color:var(--text)}

/* Topbar */
.topbar{height:50px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 1.1rem;gap:.9rem;background:rgba(9,14,26,.96);backdrop-filter:blur(24px);flex-shrink:0;z-index:100;position:sticky;top:0}
.topbar-logo{font-family:var(--font-d);font-weight:900;font-size:.92rem;letter-spacing:-.03em;color:#fff;white-space:nowrap;flex-shrink:0}
.topbar-logo span{color:var(--accent)}
.topbar-div{width:1px;height:18px;background:var(--border);flex-shrink:0}
.topbar-file{font-family:var(--font-m);font-size:.68rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:.45rem}
.stat-pill{display:flex;align-items:center;gap:.38rem;padding:.25rem .6rem;border-radius:7px;border:1px solid var(--border);background:var(--surface)}
.stat-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.stat-val{font-family:var(--font-m);font-size:.68rem;font-weight:500}
.stat-key{font-family:var(--font-m);font-size:.62rem;color:var(--text-muted)}
.icon-btn{height:30px;min-width:30px;padding:0 .4rem;border-radius:7px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:all .18s;flex-shrink:0;font-family:var(--font-m);font-size:.65rem;gap:.3rem}
.icon-btn:hover{background:var(--surface2);color:var(--text);border-color:var(--border-bright)}
.icon-btn.active{background:rgba(124,58,237,.15);border-color:rgba(124,58,237,.4);color:#a78bfa}

/* Filter bar */
.filter-bar{height:38px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 .75rem;gap:.35rem;background:var(--surface);flex-shrink:0;overflow-x:auto;scrollbar-width:none;position:sticky;top:50px;z-index:90}
.filter-bar::-webkit-scrollbar{display:none}
.filter-chip{padding:.18rem .55rem;border-radius:6px;font-family:var(--font-m);font-size:.62rem;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.filter-chip:hover{border-color:rgba(255,255,255,.2);color:var(--text)}

/* Main layout */
.main-layout{display:flex;flex:1;overflow:hidden;min-height:0}

/* Left panel — scrollable inside */
.left-panel{width:236px;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--surface);flex-shrink:0;overflow:hidden;transition:width .28s ease}
.left-panel.collapsed{width:0}
.panel-section{padding:.7rem;border-bottom:1px solid var(--border);flex-shrink:0}
.panel-title{font-family:var(--font-m);font-size:.58rem;font-weight:500;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.55rem}
.search-input{width:100%;padding:.42rem .62rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-m);font-size:.72rem;outline:none;transition:border-color .2s}
.search-input:focus{border-color:rgba(124,58,237,.5);box-shadow:0 0 0 3px rgba(124,58,237,.07)}
.search-input::placeholder{color:var(--text-dim)}
.pkg-list{flex:1;overflow-y:auto;padding:.45rem;display:flex;flex-direction:column;gap:1px}
.pkg-item{padding:.5rem .55rem;border-radius:7px;cursor:pointer;transition:background .13s;display:flex;align-items:center;gap:.45rem;min-width:0}
.pkg-item:hover{background:rgba(255,255,255,0.038)}
.pkg-item.selected{background:rgba(124,58,237,0.11)}
.pkg-sev-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pkg-name{font-family:var(--font-m);font-size:.7rem;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pkg-ri{font-family:var(--font-m);font-size:.6rem;font-weight:600;flex-shrink:0}

/* Graph canvas — the ONLY truly overflow:hidden region */
.graph-canvas{flex:1;position:relative;overflow:hidden;background:var(--bg)}
.graph-bg{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.022) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
.graph-nodes{position:absolute;inset:0}

/* Node cards */
.vuln-node{position:absolute;width:200px;border-radius:12px;border:1px solid;padding:10px 12px;cursor:pointer;transition:box-shadow .22s ease,border-color .22s ease;animation:nodeIn .38s ease}
.vuln-node:hover{z-index:10}
.vuln-node.selected{z-index:20}
.node-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;gap:4px}
.node-name{font-family:var(--font-m);font-size:.74rem;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.node-eco{font-family:var(--font-m);font-size:.55rem;padding:1px 5px;border-radius:4px;font-weight:600;flex-shrink:0;border:1px solid}
.node-metrics{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.metric-item{display:flex;flex-direction:column}
.metric-key{font-family:var(--font-m);font-size:.52rem;color:rgba(255,255,255,0.32);text-transform:uppercase;letter-spacing:.05em}
.metric-val{font-family:var(--font-m);font-size:.74rem;font-weight:600;color:#fff}
.node-footer{margin-top:6px;display:flex;align-items:center;justify-content:space-between}
.triage-badge{font-family:var(--font-m);font-size:.56rem;padding:2px 6px;border-radius:5px;font-weight:600;border:1px solid}
.blast-info{font-family:var(--font-m);font-size:.58rem;color:rgba(255,255,255,0.35)}
/* Loading shimmer on node */
.node-loading{animation:pulse 1.2s ease infinite}

/* Right sidebar — scrollable */
.right-sidebar{width:0;border-left:1px solid var(--border);background:var(--surface);overflow:hidden;transition:width .28s ease;display:flex;flex-direction:column;flex-shrink:0}
.right-sidebar.open{width:296px}
.sidebar-inner{width:296px;display:flex;flex-direction:column;height:100%;overflow-y:auto}
.sidebar-header{padding:.9rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0}
.sidebar-pkg-name{font-family:var(--font-d);font-weight:800;font-size:.95rem;line-height:1.2}
.sidebar-pkg-ver{font-family:var(--font-m);font-size:.67rem;color:var(--text-muted);margin-top:2px}
.sidebar-section{padding:.8rem 1rem;border-bottom:1px solid var(--border)}
.sidebar-section-title{font-family:var(--font-m);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);margin-bottom:.55rem}
.score-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.45rem}
.score-card{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.55rem;text-align:center}
.score-val{font-family:var(--font-m);font-size:1.15rem;font-weight:700}
.score-key{font-family:var(--font-m);font-size:.56rem;color:var(--text-muted);margin-top:1px}
.cve-list{display:flex;flex-direction:column;gap:.35rem}
.cve-item{display:flex;align-items:center;gap:.45rem;padding:.38rem .58rem;background:rgba(255,45,85,0.055);border:1px solid rgba(255,45,85,.14);border-radius:7px}
.cve-id{font-family:var(--font-m);font-size:.68rem;color:#ff2d55;flex:1}
.cve-copy-btn{width:20px;height:20px;border-radius:4px;background:rgba(255,255,255,.04);border:none;cursor:pointer;color:var(--text-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cve-copy-btn:hover{background:rgba(255,255,255,.08);color:var(--text-muted)}
.remediation-card{padding:.58rem .72rem;border-radius:8px;border:1px solid;margin-bottom:.4rem}
.remediation-action{font-family:var(--font-d);font-weight:700;font-size:.78rem;margin-bottom:.2rem}
.remediation-desc{font-family:var(--font-m);font-size:.63rem;color:rgba(255,255,255,.45);line-height:1.55}
.export-row{display:flex;gap:.4rem;padding:.7rem 1rem}
.export-btn{flex:1;padding:.45rem .3rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);font-family:var(--font-m);font-size:.65rem;cursor:pointer;transition:all .18s;text-align:center}
.export-btn:hover{border-color:rgba(124,58,237,.4);color:#a78bfa;background:rgba(124,58,237,.07)}

/* AI section */
.ai-btn{width:100%;padding:.58rem;border-radius:9px;border:1px solid rgba(124,58,237,.35);background:rgba(124,58,237,.1);color:#a78bfa;font-family:var(--font-d);font-weight:700;font-size:.78rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.4rem;transition:all .2s}
.ai-btn:hover{background:rgba(124,58,237,.18);border-color:rgba(124,58,237,.6);box-shadow:0 0 16px rgba(124,58,237,.2)}
.ai-btn:disabled{opacity:.45;cursor:not-allowed}
.ai-result{display:flex;flex-direction:column;gap:.5rem}
.ai-block{padding:.58rem .7rem;border-radius:8px}
.ai-block-label{font-family:var(--font-m);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);margin-bottom:.3rem}
.ai-block-body{font-family:var(--font-m);font-size:.67rem;color:var(--text);line-height:1.6}
.ai-cmd{font-family:var(--font-m);font-size:.67rem;color:#10b981;white-space:pre-wrap;word-break:break-all;margin:0}
.urgency-chip{display:inline-flex;padding:2px 8px;border-radius:20px;font-family:var(--font-m);font-size:.6rem;font-weight:600;border:1px solid}

/* Minimap */
.minimap{position:absolute;bottom:1rem;right:1rem;width:136px;height:86px;border-radius:10px;border:1px solid var(--border);background:rgba(9,14,26,.88);backdrop-filter:blur(10px);overflow:hidden;z-index:5}
.minimap-title{position:absolute;top:4px;left:7px;font-family:var(--font-m);font-size:.52rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;pointer-events:none}

/* Toolbar */
.graph-toolbar{position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);display:flex;gap:.28rem;padding:.38rem;background:rgba(9,14,26,.92);border:1px solid var(--border);border-radius:11px;backdrop-filter:blur(24px);z-index:5}
.zoom-label{font-family:var(--font-m);font-size:.68rem;color:var(--text-muted);padding:0 .45rem;display:flex;align-items:center;min-width:38px;justify-content:center}

/* Risk legend */
.risk-legend{position:absolute;top:1rem;left:1rem;background:rgba(9,14,26,.88);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:10px;padding:.58rem .72rem;display:flex;flex-direction:column;gap:.3rem;z-index:5;pointer-events:none}
.legend-title{font-family:var(--font-m);font-size:.52rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.1rem}
.legend-item{display:flex;align-items:center;gap:.38rem;font-family:var(--font-m);font-size:.6rem;color:var(--text-muted)}
.legend-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* Error / status banners */
.error-banner{padding:.65rem 1rem;border-radius:9px;background:rgba(255,45,85,.07);border:1px solid rgba(255,45,85,.22);font-family:var(--font-m);font-size:.73rem;color:#ff2d55;width:100%}
.info-banner{padding:.65rem 1rem;border-radius:9px;background:rgba(6,182,212,.07);border:1px solid rgba(6,182,212,.2);font-family:var(--font-m);font-size:.7rem;color:#06b6d4;width:100%;line-height:1.55}

/* Key indicator */
.key-indicator{display:flex;align-items:center;gap:.35rem;padding:.22rem .55rem;border-radius:6px;font-family:var(--font-m);font-size:.6rem;border:1px solid;flex-shrink:0}
.key-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}

/* NVD badge */
.nvd-badge{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;border-radius:5px;font-family:var(--font-m);font-size:.58rem;font-weight:600;border:1px solid rgba(6,182,212,.3);background:rgba(6,182,212,.07);color:#06b6d4}

@media(max-width:768px){
  .left-panel{display:none}
  .right-sidebar.open{width:100%;position:absolute;right:0;top:0;bottom:0;z-index:50}
  .stat-pill{display:none}
}
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const I = {
  Upload:   () => <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Shield:   ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  X:        ({s=13}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Copy:     ({s=11}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  ZoomIn:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  ZoomOut:  () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  Fit:      () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
  Panel:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
  Settings: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Sparkle:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L9 9 2 12l7 3 3 7 3-7 7-3-7-3z"/></svg>,
  Download: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Key:      () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Eye:      () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:   () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
};

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const [keys, setKeys] = useState({ ...apiKeys });
  const [provider, setProvider] = useState("gemini");
  const [showKeys, setShowKeys] = useState({});
  const [saved, setSaved] = useState(false);

  const toggle = field => setShowKeys(s => ({ ...s, [field]: !s[field] }));

  const save = () => {
    Object.assign(apiKeys, keys);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const llmFields = [
    { key:"gemini",      label:"Gemini API Key",      placeholder:"AIza…",    desc:"Free key at aistudio.google.com. Powers AI remediation.",    provider:"gemini" },
    { key:"openrouter",  label:"OpenRouter API Key",   placeholder:"sk-or-…",  desc:"Key at openrouter.ai. Uses gemini-flash-1.5.",               provider:"openrouter" },
  ];
  const dataFields = [
    { key:"nvd",         label:"NVD API Key (optional)", placeholder:"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", desc:"Boosts rate limit 50→2000 req/day. Get free at nvd.nist.gov/developers/request-an-api-key" },
  ];
  const dbFields = [
    { key:"tursoUrl",    label:"Turso Database URL",   placeholder:"libsql://your-db.turso.io" },
    { key:"tursoToken",  label:"Turso Auth Token",     placeholder:"eyJ…" },
  ];

  const renderField = f => (
    <div key={f.key} className="field-group">
      <label className="field-label">{f.label}</label>
      <div style={{ position:"relative" }}>
        <input className="field-input" type={showKeys[f.key]?"text":"password"} placeholder={f.placeholder}
          value={keys[f.key]||""} onChange={e=>setKeys(k=>({...k,[f.key]:e.target.value}))} style={{paddingRight:"2.2rem"}}/>
        <button onClick={()=>toggle(f.key)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",display:"flex"}}>
          {showKeys[f.key]?<I.EyeOff/>:<I.Eye/>}
        </button>
      </div>
      {f.desc && <div className="field-desc">{f.desc}</div>}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{display:"flex",alignItems:"center",gap:".6rem"}}><I.Key/><span className="modal-title">API Keys & Configuration</span></div>
          <button className="btn-close" onClick={onClose}><I.X/></button>
        </div>
        <div className="modal-body">
          <div className="info-banner">
            🔒 Keys are stored <strong>only in browser memory</strong> for this session — never sent anywhere except the respective API provider directly from your browser.
          </div>

          <div className="field-section">LLM Provider — AI Remediation</div>
          <div className="provider-tabs">
            {["gemini","openrouter"].map(p=>(
              <button key={p} className={`provider-tab${provider===p?" active":""}`} onClick={()=>setProvider(p)}>
                {p==="gemini"?"Google Gemini":"OpenRouter"}
              </button>
            ))}
          </div>
          {llmFields.filter(f=>f.provider===provider).map(renderField)}

          <div className="field-section">Vulnerability Data — NVD NIST</div>
          {dataFields.map(renderField)}

          <div className="field-section">Database — Turso / libSQL (optional)</div>
          {dbFields.map(renderField)}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} style={{minWidth:90}}>{saved?"✓ Saved!":"Save Keys"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Real-time OSV API fetch ───────────────────────────────────────────────────
async function queryOsv(name, version, ecosystem) {
  const eco = OSV_ECO_MAP[ecosystem] || "npm";
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ package:{ name, version, ecosystem:eco } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.vulns || [];
  } catch { return []; }
}

function parseCvssFromOsvVuln(vuln) {
  const sev = vuln.severity || [];
  for (const s of sev) {
    // Try direct numeric first
    const direct = parseFloat(s.score);
    if (!isNaN(direct) && direct >= 0 && direct <= 10) return direct;
    // Try end of vector string "CVSS:3.1/…/9.8"
    const parts = (s.score || "").split("/");
    const last = parseFloat(parts[parts.length - 1]);
    if (!isNaN(last) && last >= 0 && last <= 10) return last;
  }
  return 0;
}

// ─── NVD enrichment (optional, boosts rate limits with key) ───────────────────
async function queryNvd(cveId) {
  try {
    const headers = {};
    if (apiKeys.nvd?.trim()) headers["apiKey"] = apiKeys.nvd.trim();
    const res = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.vulnerabilities?.[0]?.cve;
    if (!item) return null;
    // Extract CVSS v3.1 score from NVD
    const metrics = item.metrics?.cvssMetricV31?.[0]?.cvssData;
    return metrics?.baseScore ?? null;
  } catch { return null; }
}

// ─── Score a single package given real OSV vulns ──────────────────────────────
function scoreFromOsv(osvVulns, cisaKevSet = new Set()) {
  if (!osvVulns.length) return { cvss:0, epss:0, ri:0, severity:"SAFE", cves:[] };
  const cves = osvVulns.map(v => v.id).filter(Boolean);
  const scores = osvVulns.map(v => parseCvssFromOsvVuln(v));
  const maxCvss = Math.max(...scores, 0);
  const inKev = cves.some(id => cisaKevSet.has(id));
  const epss = Math.min(0.99, 1/(1+Math.exp(-0.8*(maxCvss-6))) + (inKev?0.25:0));
  const ri = Math.min(10, Math.round((0.6*maxCvss + 0.25*epss*10 + (inKev?1.5:0))*10)/10);
  const severity = maxCvss>=9?"CRITICAL":maxCvss>=7?"HIGH":maxCvss>=4?"MEDIUM":maxCvss>0?"LOW":"SAFE";
  return { cvss:maxCvss, epss, ri, severity, cves };
}

// ─── SBOM Parser ──────────────────────────────────────────────────────────────
function purlToEco(purl) {
  if (!purl) return "unknown";
  const m = purl.match(/^pkg:([^/]+)\//);
  if (!m) return "unknown";
  return {npm:"npm",pypi:"pypi",maven:"maven",cargo:"cargo",golang:"go",nuget:"nuget",hex:"hex",gem:"gem",pub:"pub"}[m[1].toLowerCase()]||"unknown";
}

function parseSbomJson(content) {
  const parsed = JSON.parse(content);
  const components = parsed.components || parsed.artifacts || parsed.packages || [];
  const deps = parsed.dependencies || [];

  const raw = components.map((c,i) => ({
    id: c["bom-ref"] || c.id || c.SPDXID || `pkg-${i}`,
    name: c.name || c.packageName || "unknown",
    version: c.version || c.versionInfo || "unknown",
    ecosystem: purlToEco(c.purl || c.package?.purl || ""),
    purl: c.purl || null,
    depIds: [],
    x:0, y:0,
  }));

  deps.forEach(d => {
    const pkg = raw.find(p => p.id === d.ref);
    if (pkg) pkg.depIds = (d.dependsOn || []).filter(Boolean);
  });

  return raw;
}

function calcDepths(raw) {
  const depthMap = {};
  const calcDepth = (id, visited=new Set()) => {
    if (visited.has(id)) return 1; visited.add(id);
    const p = raw.find(x=>x.id===id);
    if (!p||!p.depIds.length) return 1;
    return 1+Math.max(...p.depIds.map(d=>calcDepth(d,new Set(visited))));
  };
  raw.forEach(p => { depthMap[p.id] = Math.min(calcDepth(p.id),6); });
  return depthMap;
}

function calcBlastRadii(raw) {
  const blastMap = {};
  raw.forEach(pkg => {
    const vis=new Set(), q=[pkg.id];
    while(q.length){ const cur=q.shift(); raw.forEach(p=>{ if(p.depIds.includes(cur)&&!vis.has(p.id)){ vis.add(p.id); q.push(p.id); } }); }
    blastMap[pkg.id]=vis.size;
  });
  return blastMap;
}

function applyLayout(pkgs) {
  const layers = {};
  pkgs.forEach(p=>{ const d=p.depth; if(!layers[d]) layers[d]=[]; layers[d].push(p); });
  let y=30;
  Object.keys(layers).sort((a,b)=>a-b).forEach(depth => {
    const layer = layers[depth].sort((a,b)=>(b.ri||0)-(a.ri||0));
    const totalW = layer.length*220+(layer.length-1)*40;
    let x = Math.max(30, 700-totalW/2);
    layer.forEach(p=>{ p.x=x; p.y=y; x+=260; });
    y+=136;
  });
}

// ─── Full real-time pipeline ───────────────────────────────────────────────────
// Returns a generator that yields progress objects, finally yielding the graph.
async function* runRealPipeline(content, filename, onProgress) {
  // Step 1: parse
  onProgress("Parsing SBOM manifest…", 5);
  await tick();
  let raw;
  try { raw = parseSbomJson(content); }
  catch(e) { throw new Error("Could not parse SBOM: " + e.message); }
  if (!raw.length) throw new Error("No components found in SBOM.");

  // Step 2: structure
  onProgress(`Building dependency graph for ${raw.length} packages…`, 12);
  await tick();
  const depthMap = calcDepths(raw);
  const blastMap = calcBlastRadii(raw);
  raw.forEach(p=>{ p.depth=depthMap[p.id]||1; p.blastRadius=blastMap[p.id]||0; });

  // Step 3: CISA KEV (best-effort, fails silently on CORS)
  onProgress("Fetching CISA KEV catalog…", 18);
  await tick();
  let cisaKevSet = new Set();
  try {
    const kevRes = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
    if (kevRes.ok) { const kev=await kevRes.json(); cisaKevSet=new Set((kev.vulnerabilities||[]).map(v=>v.cveID)); }
  } catch { /* CORS blocked in browser — skip */ }

  // Step 4: Query OSV in parallel batches of 6
  const total = raw.length;
  let done = 0;
  const BATCH = 6;
  const scored = raw.map(p=>({ ...p, cvss:0, epss:0, ri:0, severity:"SAFE", cves:[], loading:false, error:null }));

  for (let i=0; i<raw.length; i+=BATCH) {
    const batch = raw.slice(i, i+BATCH);
    const results = await Promise.all(batch.map(p=>queryOsv(p.name, p.version, p.ecosystem)));
    batch.forEach((pkg, j) => {
      const idx = scored.findIndex(s=>s.id===pkg.id);
      if (idx>=0) Object.assign(scored[idx], scoreFromOsv(results[j]||[], cisaKevSet));
    });
    done += batch.length;
    const pct = 18 + Math.round((done/total)*72);
    onProgress(`Querying OSV API… (${done}/${total})`, pct);
    await tick();
  }

  // Step 5: layout
  onProgress("Generating graph layout…", 94);
  await tick();
  applyLayout(scored);

  const edges = [];
  raw.forEach(pkg=>pkg.depIds.forEach((t,i)=>edges.push({id:`e-${pkg.id}-${t}-${i}`,source:pkg.id,target:t})));

  onProgress("Analysis complete.", 100);
  return { packages:scored, edges, meta:{ filename, format:"cyclonedx-json", packageCount:scored.length, scannedAt:new Date().toISOString() } };
}

function tick() { return new Promise(r=>setTimeout(r,0)); }

// ─── Mock data (12-pkg demo, pre-scored) ──────────────────────────────────────
function buildMockPackages() {
  const MOCK_OSV_STATIC = {
    p1:[{id:"CVE-2021-23337",cvss:7.2},{id:"CVE-2020-28500",cvss:5.3}],
    p2:[{id:"CVE-2021-3749",cvss:7.5}],
    p3:[{id:"CVE-2021-44228",cvss:10.0},{id:"CVE-2021-45046",cvss:9.0}],
    p4:[{id:"CVE-2023-32681",cvss:6.1}],
    p5:[{id:"CVE-2022-24999",cvss:7.5}],
    p6:[],p7:[{id:"CVE-2021-45115",cvss:7.5},{id:"CVE-2021-45116",cvss:7.5}],p8:[],
    p9:[{id:"CVE-2022-22965",cvss:9.8},{id:"CVE-2022-22950",cvss:6.5}],
    p10:[{id:"CVE-2022-0778",cvss:7.5}],p11:[{id:"CVE-2022-24785",cvss:7.5}],p12:[{id:"CVE-2023-0286",cvss:7.4}],
  };
  const CISA_MOCK = new Set(["CVE-2021-44228","CVE-2022-22965"]);
  const raw=[
    {id:"p1",name:"lodash",version:"4.17.20",ecosystem:"npm",depIds:["p4","p5"]},
    {id:"p2",name:"axios",version:"0.21.1",ecosystem:"npm",depIds:["p5","p11"]},
    {id:"p3",name:"log4j-core",version:"2.14.1",ecosystem:"maven",depIds:["p9","p10"]},
    {id:"p4",name:"requests",version:"2.25.1",ecosystem:"pypi",depIds:[]},
    {id:"p5",name:"express",version:"4.17.1",ecosystem:"npm",depIds:["p8","p11"]},
    {id:"p6",name:"serde",version:"1.0.130",ecosystem:"cargo",depIds:[]},
    {id:"p7",name:"django",version:"3.2.9",ecosystem:"pypi",depIds:["p4","p12"]},
    {id:"p8",name:"react",version:"17.0.2",ecosystem:"npm",depIds:[]},
    {id:"p9",name:"spring-core",version:"5.3.13",ecosystem:"maven",depIds:["p6"]},
    {id:"p10",name:"openssl",version:"1.1.1l",ecosystem:"cargo",depIds:["p6"]},
    {id:"p11",name:"moment",version:"2.29.1",ecosystem:"npm",depIds:[]},
    {id:"p12",name:"cryptography",version:"3.3.1",ecosystem:"pypi",depIds:[]},
  ];
  const depthMap=calcDepths(raw), blastMap=calcBlastRadii(raw);
  const scored=raw.map(pkg=>{
    const vulns=MOCK_OSV_STATIC[pkg.id]||[];
    const maxCvss=vulns.length?Math.max(...vulns.map(v=>v.cvss)):0;
    const inKev=vulns.some(v=>CISA_MOCK.has(v.id));
    const epss=Math.min(0.99,1/(1+Math.exp(-0.8*(maxCvss-6)))+(inKev?0.25:0));
    const ri=Math.min(10,Math.round((0.6*maxCvss+0.25*epss*10+(inKev?1.5:0))*10)/10);
    const sev=maxCvss>=9?"CRITICAL":maxCvss>=7?"HIGH":maxCvss>=4?"MEDIUM":maxCvss>0?"LOW":"SAFE";
    return {...pkg,cvss:maxCvss,epss,ri,depth:depthMap[pkg.id]||1,blastRadius:blastMap[pkg.id]||0,severity:sev,cves:vulns.map(v=>v.id),x:0,y:0,loading:false,error:null};
  });
  applyLayout(scored);
  const edges=[];
  raw.forEach(pkg=>pkg.depIds.forEach((t,i)=>edges.push({id:`e-${pkg.id}-${t}-${i}`,source:pkg.id,target:t})));
  return {packages:scored,edges,meta:{filename:"12-pkg-demo.sbom.json",format:"cyclonedx-json",packageCount:scored.length,scannedAt:new Date().toISOString()}};
}

// ─── LLM Client ───────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const key=apiKeys.gemini.trim();
  if(!key) throw new Error("No Gemini API key. Click ⚙ Keys to add one.");
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:400,temperature:.2}}),
  });
  if(!res.ok){const t=await res.text();throw new Error(`Gemini ${res.status}: ${t.slice(0,160)}`)}
  const d=await res.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text??"{}";
}

async function callOpenRouter(prompt) {
  const key=apiKeys.openrouter.trim();
  if(!key) throw new Error("No OpenRouter API key. Click ⚙ Keys to add one.");
  const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`,"HTTP-Referer":location.href,"X-Title":"CyberVine-Guard"},
    body:JSON.stringify({model:"google/gemini-flash-1.5",messages:[{role:"user",content:prompt}],max_tokens:400,temperature:.2,response_format:{type:"json_object"}}),
  });
  if(!res.ok){const t=await res.text();throw new Error(`OpenRouter ${res.status}: ${t.slice(0,160)}`)}
  const d=await res.json();
  return d?.choices?.[0]?.message?.content??"{}";
}

async function generateRemediation(pkg) {
  const prompt=`You are a senior AppSec engineer. Respond ONLY with valid JSON, no markdown.

Package: ${pkg.name}@${pkg.version} (${pkg.ecosystem})
CVE: ${pkg.cves[0]||"unknown"}  CVSS: ${pkg.cvss}  Severity: ${pkg.severity}

Return JSON with exactly:
{"summary":"<2-sentence impact summary>","fixCommand":"<exact shell command to fix>","urgency":"<immediate|sprint|quarterly|monitor>","references":["<url>"]}`;

  const raw=apiKeys.gemini.trim()?await callGemini(prompt):await callOpenRouter(prompt);
  const clean=raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  try {
    const p=JSON.parse(clean);
    return {summary:p.summary||"No summary.",fixCommand:p.fixCommand||"# No command.",urgency:["immediate","sprint","quarterly","monitor"].includes(p.urgency)?p.urgency:"monitor",references:Array.isArray(p.references)?p.references.slice(0,4):[]};
  } catch { return {summary:clean.slice(0,300),fixCommand:"# Parse error",urgency:"monitor",references:[]}; }
}

// ─── VulnNode ─────────────────────────────────────────────────────────────────
const VulnNode = memo(function VulnNode({ pkg, selected, onClick, transform }) {
  const sev=SEVERITY_META[pkg.severity]||SEVERITY_META.SAFE;
  const eco=ECOSYSTEM_META[pkg.ecosystem]||ECOSYSTEM_META.unknown;
  const {scale,tx,ty}=transform;
  const x=pkg.x*scale+tx, y=pkg.y*scale+ty;
  const innerScale=scale<0.55?(1/scale)*0.55:1;
  return (
    <div className={`vuln-node${selected?" selected":""}${pkg.loading?" node-loading":""}`}
      style={{left:x,top:y,borderColor:selected?sev.color:`${sev.color}50`,
        background:selected?`linear-gradient(145deg,${sev.bg} 0%,rgba(9,14,26,0.97) 100%)`:"rgba(9,14,26,0.93)",
        boxShadow:selected?`0 0 28px ${sev.glow},0 0 0 1px ${sev.color}30,0 6px 20px rgba(0,0,0,0.5)`:"0 2px 10px rgba(0,0,0,0.35)",
        transform:`scale(${innerScale})`,transformOrigin:"top left"}}
      onClick={()=>onClick(pkg)}>
      <div className="node-header">
        <div className="node-name" style={{color:sev.color}}>{pkg.name}</div>
        <div className="node-eco" style={{background:`${eco.color}20`,color:eco.color,borderColor:`${eco.color}40`}}>{eco.label}</div>
      </div>
      <div className="node-metrics">
        {[["CVSS",pkg.loading?"…":pkg.cvss.toFixed(1),sev.color],["EPSS",pkg.loading?"…":`${(pkg.epss*100).toFixed(0)}%`,null],
          ["Ri",pkg.loading?"…":pkg.ri.toFixed(1),sev.color],["Depth",`L${pkg.depth}`,null]].map(([k,v,c])=>(
          <div key={k} className="metric-item">
            <span className="metric-key">{k}</span>
            <span className="metric-val" style={c?{color:c}:{}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="node-footer">
        <div className="triage-badge" style={{color:sev.color,borderColor:`${sev.color}40`,background:sev.bg}}>{sev.label}</div>
        <div className="blast-info">⚡ {pkg.blastRadius}</div>
      </div>
    </div>
  );
});

// ─── GraphEdges ───────────────────────────────────────────────────────────────
const GraphEdges = memo(function GraphEdges({ packages, edges, transform, selectedId }) {
  const map=useMemo(()=>new Map(packages.map(p=>[p.id,p])),[packages]);
  const {scale,tx,ty}=transform;
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none"}}>
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="rgba(124,58,237,0.38)"/></marker>
        <marker id="arr-a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#7c3aed"/></marker>
      </defs>
      {edges.map(e=>{
        const s=map.get(e.source),t=map.get(e.target);
        if(!s||!t) return null;
        const sx=(s.x+100)*scale+tx,sy=(s.y+50)*scale+ty;
        const ex=(t.x+100)*scale+tx,ey=(t.y+50)*scale+ty;
        const mx=(sx+ex)/2;
        const active=selectedId===e.source||selectedId===e.target;
        return <path key={e.id} d={`M${sx} ${sy} C${mx} ${sy},${mx} ${ey},${ex} ${ey}`}
          stroke={active?"rgba(124,58,237,0.82)":"rgba(255,255,255,0.065)"} strokeWidth={active?1.5:1}
          fill="none" markerEnd={active?"url(#arr-a)":"url(#arr)"}
          style={{animation:active?"edgePulse 2s ease infinite":"none"}}/>;
      })}
    </svg>
  );
});

// ─── Minimap ──────────────────────────────────────────────────────────────────
const Minimap = memo(function Minimap({ packages }) {
  if(!packages.length) return null;
  const minX=Math.min(...packages.map(p=>p.x)),minY=Math.min(...packages.map(p=>p.y));
  const maxX=Math.max(...packages.map(p=>p.x+200)),maxY=Math.max(...packages.map(p=>p.y+80));
  const rx=Math.max(maxX-minX,1),ry=Math.max(maxY-minY,1);
  return (
    <div className="minimap">
      <div className="minimap-title">MAP</div>
      <svg width="136" height="86" style={{display:"block"}}>
        {packages.map(p=>{
          const s=SEVERITY_META[p.severity]||SEVERITY_META.SAFE;
          return <circle key={p.id} cx={((p.x-minX)/rx)*116+10} cy={((p.y-minY)/ry)*66+14} r={3} fill={s.color} opacity={.75}/>;
        })}
      </svg>
    </div>
  );
});

// ─── NodeSidebar ──────────────────────────────────────────────────────────────
function NodeSidebar({ pkg, onClose }) {
  const [aiState,setAiState]=useState("idle");
  const [aiResult,setAiResult]=useState(null);
  const [aiError,setAiError]=useState(null);
  const [copied,setCopied]=useState(null);

  useEffect(()=>{setAiState("idle");setAiResult(null);setAiError(null);},[pkg?.id]);
  if(!pkg) return null;

  const sev=SEVERITY_META[pkg.severity]||SEVERITY_META.SAFE;
  const eco=ECOSYSTEM_META[pkg.ecosystem]||ECOSYSTEM_META.unknown;
  const hasKey=apiKeys.gemini.trim()||apiKeys.openrouter.trim();
  const urgencyColor={immediate:"#ff2d55",sprint:"#ff6b00",quarterly:"#f59e0b",monitor:"#22d3ee"};

  const copyCve=cve=>{navigator.clipboard?.writeText(cve);setCopied(cve);setTimeout(()=>setCopied(null),1500);};
  const runAi=async()=>{setAiState("loading");setAiResult(null);setAiError(null);try{const r=await generateRemediation(pkg);setAiResult(r);setAiState("done");}catch(e){setAiError(e.message);setAiState("error");}};
  const exportJson=()=>{const b=new Blob([JSON.stringify(pkg,null,2)],{type:"application/json"});const u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=`${pkg.name}-vuln.json`;a.click();URL.revokeObjectURL(u);};
  const copyReport=()=>{const t=`${pkg.name}@${pkg.version} (${pkg.ecosystem})\nSeverity: ${pkg.severity}\nCVSS: ${pkg.cvss} | EPSS: ${(pkg.epss*100).toFixed(0)}% | Ri: ${pkg.ri}\nCVEs: ${pkg.cves.join(", ")||"none"}\nBlast Radius: ${pkg.blastRadius} packages${aiResult?`\n\nAI Summary:\n${aiResult.summary}\nFix: ${aiResult.fixCommand}`:""}`;navigator.clipboard?.writeText(t);};

  const REMED={
    CRITICAL:{action:"Immediate Patch Required",desc:`Upgrade ${pkg.name} NOW. Isolate affected services, enable WAF rules, page on-call. CVSS ${pkg.cvss}.`},
    HIGH:    {action:"Patch Within 7 Days",      desc:`Schedule ${pkg.name} upgrade in current sprint. Review ${pkg.blastRadius} transitive dependents.`},
    MEDIUM:  {action:"Strategic Replacement",    desc:`Evaluate ${pkg.name} alternatives in next quarterly audit. Low exploitation probability.`},
    LOW:     {action:"Monitor & Track",           desc:`Add ${pkg.name} to watchlist. Review in next dependency audit cycle.`},
    SAFE:    {action:"No Action Required",        desc:`${pkg.name} has no known vulnerabilities at this version.`},
  }[pkg.severity];

  return (
    <div className="sidebar-inner">
      <div className="sidebar-header">
        <div>
          <div className="sidebar-pkg-name" style={{color:sev.color}}>{pkg.name}</div>
          <div className="sidebar-pkg-ver">v{pkg.version} · <span style={{color:eco.color}}>{eco.label}</span></div>
        </div>
        <button className="btn-close" onClick={onClose}><I.X/></button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Risk Scores</div>
        <div className="score-grid">
          {[["CVSS v3",pkg.cvss.toFixed(1),sev.color],["EPSS",`${(pkg.epss*100).toFixed(0)}%`,"#06b6d4"],["Ri Score",pkg.ri.toFixed(1),sev.color]].map(([k,v,c])=>(
            <div key={k} className="score-card"><div className="score-val" style={{color:c}}>{v}</div><div className="score-key">{k}</div></div>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Metadata</div>
        {[["Blast Radius",`${pkg.blastRadius} pkgs`],["Dep. Depth",`Level ${pkg.depth}`],["Severity",sev.label],["CVEs",`${pkg.cves.length} found`]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:".32rem"}}>
            <span style={{fontFamily:"var(--font-m)",fontSize:".66rem",color:"var(--text-muted)"}}>{k}</span>
            <span style={{fontFamily:"var(--font-m)",fontSize:".66rem",color:"var(--text)"}}>{v}</span>
          </div>
        ))}
      </div>

      {pkg.cves.length>0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">CVE Intelligence <span className="nvd-badge" style={{marginLeft:6}}>OSV Live</span></div>
          <div className="cve-list">
            {pkg.cves.map(c=>(
              <div key={c} className="cve-item">
                <span className="cve-id">{c}</span>
                <button className="cve-copy-btn" onClick={()=>copyCve(c)}>
                  {copied===c?<span style={{fontSize:".6rem",color:"#10b981"}}>✓</span>:<I.Copy/>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-title">Static Guidance</div>
        <div className="remediation-card" style={{borderColor:`${sev.color}30`,background:sev.bg}}>
          <div className="remediation-action" style={{color:sev.color}}>{REMED.action}</div>
          <div className="remediation-desc">{REMED.desc}</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">AI-Generated Patch</div>
        {aiState==="idle"&&(
          <button className="ai-btn" onClick={runAi} disabled={!hasKey||pkg.cves.length===0}>
            <I.Sparkle/>{!hasKey?"Add API key in ⚙ Keys":pkg.cves.length===0?"No CVEs to analyse":"Generate AI Remediation"}
          </button>
        )}
        {aiState==="loading"&&(
          <div style={{display:"flex",alignItems:"center",gap:".6rem",padding:".5rem",fontFamily:"var(--font-m)",fontSize:".68rem",color:"var(--text-muted)"}}>
            <div style={{width:14,height:14,border:"2px solid rgba(124,58,237,.2)",borderTopColor:"#7c3aed",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>Calling LLM…
          </div>
        )}
        {aiState==="error"&&(
          <div>
            <div style={{padding:".55rem .65rem",borderRadius:8,background:"rgba(255,45,85,.06)",border:"1px solid rgba(255,45,85,.2)",fontFamily:"var(--font-m)",fontSize:".66rem",color:"#ff2d55",marginBottom:".4rem"}}>⚠ {aiError}</div>
            <button className="ai-btn" onClick={runAi} style={{marginTop:".2rem"}}>Retry</button>
          </div>
        )}
        {aiState==="done"&&aiResult&&(
          <div className="ai-result">
            <div className="ai-block" style={{background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.18)"}}>
              <div className="ai-block-label">Summary</div>
              <div className="ai-block-body">{aiResult.summary}</div>
            </div>
            <div className="ai-block" style={{background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.18)"}}>
              <div className="ai-block-label">Fix Command</div>
              <pre className="ai-cmd">{aiResult.fixCommand}</pre>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:".5rem",padding:"0 .1rem"}}>
              <span style={{fontFamily:"var(--font-m)",fontSize:".6rem",color:"var(--text-muted)"}}>Urgency:</span>
              <span className="urgency-chip" style={{color:urgencyColor[aiResult.urgency]||"#22d3ee",borderColor:`${urgencyColor[aiResult.urgency]||"#22d3ee"}44`,background:`${urgencyColor[aiResult.urgency]||"#22d3ee"}0f`}}>
                {aiResult.urgency.toUpperCase()}
              </span>
            </div>
            {aiResult.references.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:".2rem"}}>
                {aiResult.references.map((r,i)=>(
                  <a key={i} href={r} target="_blank" rel="noopener" style={{fontFamily:"var(--font-m)",fontSize:".62rem",color:"#06b6d4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r}</a>
                ))}
              </div>
            )}
            <button onClick={()=>{setAiState("idle");setAiResult(null);}} style={{background:"none",border:"none",color:"var(--text-dim)",fontFamily:"var(--font-m)",fontSize:".6rem",cursor:"pointer",textAlign:"left",padding:0}}>← Regenerate</button>
          </div>
        )}
      </div>

      <div className="export-row">
        <button className="export-btn" onClick={exportJson}><I.Download/> JSON</button>
        <button className="export-btn" onClick={copyReport}><I.Copy/> Report</button>
      </div>
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen({ step, progress }) {
  return (
    <div className="onboard" style={{minHeight:"100dvh"}}>
      <div className="onboard-bg"><div className="blob blob-1"/><div className="blob blob-2"/><div className="blob blob-3"/><div className="grid-overlay"/></div>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"1.75rem"}}>
        <div style={{position:"relative"}}>
          <div className="spinner"/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><I.Shield s={16}/></div>
        </div>
        <div style={{width:300}}>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
          <div className="progress-label"><span>{step}</span><span>{progress}%</span></div>
        </div>
        <div style={{fontFamily:"var(--font-m)",fontSize:".62rem",color:"var(--text-dim)",textAlign:"center",lineHeight:1.6}}>
          Querying OSV vulnerability DB in real-time…<br/>
          {apiKeys.nvd?.trim()&&<span style={{color:"#06b6d4"}}>NVD key active — higher rate limits.</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Demo SBOMs ───────────────────────────────────────────────────────────────
const DEMO_SBOMS = {
  "log4shell.sbom.json": { bomFormat:"CycloneDX",specVersion:"1.4",components:[
    {type:"library","bom-ref":"p1",name:"log4j-core",version:"2.14.1",purl:"pkg:maven/org.apache.logging.log4j:log4j-core@2.14.1"},
    {type:"library","bom-ref":"p2",name:"log4j-api",version:"2.14.1",purl:"pkg:maven/org.apache.logging.log4j:log4j-api@2.14.1"},
    {type:"library","bom-ref":"p3",name:"spring-core",version:"5.3.13",purl:"pkg:maven/org.springframework:spring-core@5.3.13"},
    {type:"library","bom-ref":"p4",name:"jackson-databind",version:"2.13.0",purl:"pkg:maven/com.fasterxml.jackson.core:jackson-databind@2.13.0"},
  ], dependencies:[{ref:"p1",dependsOn:["p2"]},{ref:"p3",dependsOn:["p4"]}] },
  "spring4shell.sbom.json": { bomFormat:"CycloneDX",specVersion:"1.4",components:[
    {type:"library","bom-ref":"s1",name:"spring-webmvc",version:"5.3.17",purl:"pkg:maven/org.springframework:spring-webmvc@5.3.17"},
    {type:"library","bom-ref":"s2",name:"spring-beans",version:"5.3.17",purl:"pkg:maven/org.springframework:spring-beans@5.3.17"},
    {type:"library","bom-ref":"s3",name:"tomcat-embed-core",version:"9.0.60",purl:"pkg:maven/org.apache.tomcat.embed:tomcat-embed-core@9.0.60"},
    {type:"library","bom-ref":"s4",name:"snakeyaml",version:"1.29",purl:"pkg:maven/org.yaml:snakeyaml@1.29"},
  ], dependencies:[{ref:"s1",dependsOn:["s2","s3"]},{ref:"s2",dependsOn:["s4"]}] },
  "node-supply-chain.sbom.json": { bomFormat:"CycloneDX",specVersion:"1.4",components:[
    {type:"library","bom-ref":"n1",name:"lodash",version:"4.17.20",purl:"pkg:npm/lodash@4.17.20"},
    {type:"library","bom-ref":"n2",name:"axios",version:"0.21.1",purl:"pkg:npm/axios@0.21.1"},
    {type:"library","bom-ref":"n3",name:"express",version:"4.17.1",purl:"pkg:npm/express@4.17.1"},
    {type:"library","bom-ref":"n4",name:"moment",version:"2.29.1",purl:"pkg:npm/moment@2.29.1"},
    {type:"library","bom-ref":"n5",name:"follow-redirects",version:"1.14.7",purl:"pkg:npm/follow-redirects@1.14.7"},
  ], dependencies:[{ref:"n2",dependsOn:["n5"]},{ref:"n3",dependsOn:["n1","n4"]}] },
};

// ─── Onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ onDone, onSettings }) {
  const [dragging,setDragging]=useState(false);
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState("");
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState(null);
  const fileRef=useRef(null);

  const onProgress=useCallback((s,p)=>{setStep(s);setProgress(p);},[]);

  const runPipeline=useCallback(async(content,filename)=>{
    setLoading(true);setError(null);setStep("Starting…");setProgress(0);
    try {
      const graph = await runRealPipeline(content, filename, onProgress);
      graph.meta.filename=filename;
      onDone(graph);
    } catch(e) {
      setLoading(false);
      setError(e.message+" — Try a demo scenario below.");
    }
  },[onDone,onProgress]);

  const startDemo=useCallback(name=>{
    const content=JSON.stringify(DEMO_SBOMS[name],null,2);
    runPipeline(content,name);
  },[runPipeline]);

  const startMock=useCallback(()=>{
    setLoading(true);setStep("Loading demo data…");setProgress(50);
    setTimeout(()=>{ onDone(buildMockPackages()); },600);
  },[onDone]);

  const handleFile=useCallback(file=>{
    const r=new FileReader();
    r.onload=e=>runPipeline(e.target.result,file.name);
    r.onerror=()=>setError("Could not read file.");
    r.readAsText(file);
  },[runPipeline]);

  if(loading) return <LoadingScreen step={step} progress={progress}/>;

  return (
    <div className="onboard">
      <div className="onboard-bg">
        <div className="blob blob-1"/><div className="blob blob-2"/>
        <div className="blob blob-3"/><div className="blob blob-4"/>
        <div className="grid-overlay"/><div className="scanline"/>
      </div>
      <div className="onboard-inner">
        <div style={{display:"flex",alignItems:"center",width:"100%",justifyContent:"space-between"}}>
          <div className="logo-mark">
            <div className="logo-hex">
              <svg viewBox="0 0 40 40" fill="none">
                <path d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z" stroke="#7c3aed" strokeWidth="1.5" fill="rgba(124,58,237,0.07)"/>
                <path d="M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z" fill="rgba(124,58,237,0.13)" stroke="rgba(124,58,237,0.38)" strokeWidth="1"/>
                <circle cx="20" cy="20" r="4" fill="#7c3aed"/>
              </svg>
            </div>
            <div className="logo-wordmark">CyberVine<span>Guard</span></div>
          </div>
          <button className="icon-btn" onClick={onSettings} style={{gap:".35rem"}}><I.Settings/><span>API Keys</span></button>
        </div>

        <div className="hero-headline">
          <h1>Supply Chain<br/><em>Vulnerability Intelligence</em></h1>
          <p>Upload your SBOM · Real-time OSV scan · AI remediation</p>
        </div>

        {error&&<div className="error-banner">⚠ {error}</div>}

        <div className="info-banner" style={{fontSize:".68rem"}}>
          <strong>Real-time mode:</strong> uploaded files are scored live via the public <strong>OSV API</strong> (api.osv.dev). 
          Add an <strong>NVD key</strong> in ⚙ Keys for higher rate limits on large SBOMs.
        </div>

        <div className={`upload-zone${dragging?" dragging":""}`}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
          onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".json,.xml,.spdx,.cdx,.txt" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
          <div className="upload-icon"><I.Upload/></div>
          <div className="upload-label">Drop your SBOM here</div>
          <div className="upload-sub">or click to browse — scores queried live from OSV</div>
          <div className="upload-formats">
            {["CycloneDX JSON","SPDX 2.3","SPDX 3.0","CycloneDX XML","Syft JSON"].map(f=>(
              <span key={f} className="fmt-badge">{f}</span>
            ))}
          </div>
        </div>

        <div className="or-divider"><div className="or-line"/><div className="or-text">or try a demo scenario</div><div className="or-line"/></div>

        <div className="demo-btns">
          {Object.keys(DEMO_SBOMS).map(name=>(
            <button key={name} className="demo-btn" onClick={()=>startDemo(name)}>{name}</button>
          ))}
          <button className="demo-btn" onClick={startMock} style={{background:"rgba(6,182,212,0.1)",borderColor:"rgba(6,182,212,0.3)",color:"#06b6d4"}}>
            Full 12-pkg Demo ✦
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Visualizer ───────────────────────────────────────────────────────────────
function Visualizer({ graph, onReset, onSettings }) {
  const [selected,setSelected]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [leftCollapsed,setLeftCollapsed]=useState(false);
  const [search,setSearch]=useState("");
  const [sevFilter,setSevFilter]=useState("ALL");
  const [zoom,setZoom]=useState(0.75);
  const [pan,setPan]=useState({x:40,y:30});
  const [panning,setPanning]=useState(false);
  const panStart=useRef(null);
  const canvasRef=useRef(null);

  const transform=useMemo(()=>({scale:zoom,tx:pan.x,ty:pan.y}),[zoom,pan]);

  const stats=useMemo(()=>({
    critical:graph.packages.filter(p=>p.severity==="CRITICAL").length,
    high:graph.packages.filter(p=>p.severity==="HIGH").length,
    medium:graph.packages.filter(p=>p.severity==="MEDIUM").length,
    total:graph.packages.length,
    avgRi:graph.packages.length?(graph.packages.reduce((a,p)=>a+p.ri,0)/graph.packages.length).toFixed(1):"0.0",
  }),[graph]);

  const filtered=useMemo(()=>graph.packages.filter(p=>{
    if(sevFilter!=="ALL"&&p.severity!==sevFilter) return false;
    if(search.trim()){const s=search.toLowerCase();return p.name.toLowerCase().includes(s)||p.cves.some(c=>c.toLowerCase().includes(s));}
    return true;
  }).sort((a,b)=>b.ri-a.ri),[graph.packages,sevFilter,search]);

  const handleWheel=useCallback(e=>{
    e.preventDefault();
    setZoom(z=>Math.max(0.2,Math.min(3.5,z*(e.deltaY>0?.88:1.12))));
  },[]);

  useEffect(()=>{
    const el=canvasRef.current;if(!el) return;
    el.addEventListener("wheel",handleWheel,{passive:false});
    return()=>el.removeEventListener("wheel",handleWheel);
  },[handleWheel]);

  const onMouseDown=useCallback(e=>{
    if(e.target.closest(".vuln-node")) return;
    setPanning(true);panStart.current={x:e.clientX-pan.x,y:e.clientY-pan.y};
  },[pan]);
  const onMouseMove=useCallback(e=>{
    if(!panning||!panStart.current) return;
    setPan({x:e.clientX-panStart.current.x,y:e.clientY-panStart.current.y});
  },[panning]);
  const onMouseUp=useCallback(()=>{setPanning(false);panStart.current=null;},[]);

  const fitView=useCallback(()=>{
    if(!canvasRef.current||!graph.packages.length) return;
    const{width,height}=canvasRef.current.getBoundingClientRect();
    const minX=Math.min(...graph.packages.map(p=>p.x)),minY=Math.min(...graph.packages.map(p=>p.y));
    const maxX=Math.max(...graph.packages.map(p=>p.x+200)),maxY=Math.max(...graph.packages.map(p=>p.y+80));
    const s=Math.min((width-80)/(maxX-minX),(height-80)/(maxY-minY),1);
    setZoom(Math.max(0.2,s));
    setPan({x:(width-(maxX-minX)*s)/2-minX*s,y:(height-(maxY-minY)*s)/2-minY*s});
  },[graph.packages]);

  useEffect(()=>{setTimeout(fitView,100);},[graph]);

  const handleNodeClick=useCallback(pkg=>{setSelected(pkg);setSidebarOpen(true);},[]);
  const handleClose=useCallback(()=>{setSidebarOpen(false);setSelected(null);},[]);

  const exportReport=()=>{
    const r={meta:graph.meta,stats,packages:graph.packages.map(p=>({name:p.name,version:p.version,severity:p.severity,cvss:p.cvss,ri:p.ri,cves:p.cves}))};
    const b=new Blob([JSON.stringify(r,null,2)],{type:"application/json"});
    const u=URL.createObjectURL(b),a=document.createElement("a");
    a.href=u;a.download=`CyberVine-Guard-report-${Date.now()}.json`;a.click();URL.revokeObjectURL(u);
  };

  const hasKey=apiKeys.gemini.trim()||apiKeys.openrouter.trim();

  return (
    <div className="app">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-logo">CyberVine<span>Guard</span></div>
        <div className="topbar-div"/>
        <div className="topbar-file">{graph.meta.filename}</div>
        <div style={{display:"flex",gap:".35rem",flexWrap:"nowrap"}}>
          {[[stats.critical,"CRITICAL","#ff2d55"],[stats.high,"HIGH","#ff6b00"],[stats.medium,"MEDIUM","#f59e0b"]].map(([n,k,c])=>(
            <div key={k} className="stat-pill">
              <div className="stat-dot" style={{background:c}}/>
              <span className="stat-val" style={{color:c}}>{n} {k.charAt(0)+k.slice(1).toLowerCase()}</span>
            </div>
          ))}
          <div className="stat-pill"><span className="stat-val">{stats.total}</span><span className="stat-key">pkgs</span></div>
          <div className="stat-pill"><span className="stat-key">Avg Ri</span><span className="stat-val" style={{color:"#a78bfa"}}>{stats.avgRi}</span></div>
        </div>
        <div className="topbar-right">
          <div className="key-indicator" style={{borderColor:hasKey?"rgba(16,185,129,.3)":"rgba(255,45,85,.25)",background:hasKey?"rgba(16,185,129,.06)":"rgba(255,45,85,.05)"}}>
            <div className="key-dot" style={{background:hasKey?"#10b981":"#ff2d55"}}/>
            <span style={{color:hasKey?"#10b981":"#ff2d55"}}>{hasKey?"AI On":"No Key"}</span>
          </div>
          {apiKeys.nvd?.trim()&&<div className="nvd-badge">NVD ✓</div>}
          <button className="icon-btn" onClick={onSettings}><I.Settings/><span>Keys</span></button>
          <button className="icon-btn" onClick={exportReport}><I.Download/><span>Report</span></button>
          <button className="icon-btn" onClick={onReset}>← New SBOM</button>
          <button className={`icon-btn${!leftCollapsed?" active":""}`} onClick={()=>setLeftCollapsed(c=>!c)}><I.Panel/></button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <span style={{fontFamily:"var(--font-m)",fontSize:".58rem",color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:".1em",flexShrink:0,marginRight:".15rem"}}>Filter</span>
        {["ALL",...SEVERITY_ORDER].map(f=>{
          const m=f!=="ALL"?SEVERITY_META[f]:null;
          const active=sevFilter===f;
          return <div key={f} className={`filter-chip${active?" active":""}`} onClick={()=>setSevFilter(f)}
            style={active?{background:m?m.bg:"rgba(124,58,237,.18)",borderColor:m?m.color:"#7c3aed",color:m?m.color:"#a78bfa"}:{}}
          >{f}</div>;
        })}
        <div style={{marginLeft:"auto",fontFamily:"var(--font-m)",fontSize:".62rem",color:"var(--text-muted)",flexShrink:0}}>{filtered.length}/{graph.packages.length}</div>
      </div>

      {/* Main */}
      <div className="main-layout">
        {/* Left panel */}
        <div className={`left-panel${leftCollapsed?" collapsed":""}`}>
          <div className="panel-section">
            <div className="panel-title">Packages</div>
            <input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="pkg-list">
            {filtered.map(pkg=>{
              const s=SEVERITY_META[pkg.severity]||SEVERITY_META.SAFE;
              return (
                <div key={pkg.id} className={`pkg-item${selected?.id===pkg.id?" selected":""}`} onClick={()=>handleNodeClick(pkg)}>
                  <div className="pkg-sev-dot" style={{background:s.color}}/>
                  <div className="pkg-name">{pkg.name}</div>
                  <div className="pkg-ri" style={{color:s.color}}>{pkg.ri.toFixed(1)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div className="graph-canvas" ref={canvasRef}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          style={{cursor:panning?"grabbing":"grab"}}>
          <div className="graph-bg"/>
          <div className="graph-nodes">
            <GraphEdges packages={graph.packages} edges={graph.edges} transform={transform} selectedId={selected?.id??null}/>
            {filtered.map(pkg=>(
              <VulnNode key={pkg.id} pkg={pkg} selected={selected?.id===pkg.id} onClick={handleNodeClick} transform={transform}/>
            ))}
          </div>

          <div className="risk-legend">
            <div className="legend-title">Severity</div>
            {SEVERITY_ORDER.map(k=>{
              const v=SEVERITY_META[k];
              return <div key={k} className="legend-item"><div className="legend-dot" style={{background:v.color}}/>{v.label}</div>;
            })}
          </div>

          <div className="graph-toolbar">
            <button className="icon-btn" onClick={()=>setZoom(z=>Math.min(3.5,z*1.2))}><I.ZoomIn/></button>
            <div className="zoom-label">{Math.round(zoom*100)}%</div>
            <button className="icon-btn" onClick={()=>setZoom(z=>Math.max(0.2,z*0.82))}><I.ZoomOut/></button>
            <button className="icon-btn" onClick={fitView}><I.Fit/></button>
          </div>

          <Minimap packages={graph.packages}/>
        </div>

        {/* Right sidebar */}
        <div className={`right-sidebar${sidebarOpen?" open":""}`}>
          <NodeSidebar pkg={selected} onClose={handleClose}/>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]=useState("onboard");
  const [graph,setGraph]=useState(null);
  const [showSettings,setShowSettings]=useState(false);

  const handleDone=useCallback(g=>{setGraph(g);setView("visualizer");},[]);
  const handleReset=useCallback(()=>{setGraph(null);setView("onboard");},[]);

  return (
    <>
      <style>{CSS}</style>
      {showSettings&&<SettingsModal onClose={()=>setShowSettings(false)}/>}
      {view==="onboard"
        ?<Onboarding onDone={handleDone} onSettings={()=>setShowSettings(true)}/>
        :<Visualizer graph={graph} onReset={handleReset} onSettings={()=>setShowSettings(true)}/>
      }
    </>
  );
}