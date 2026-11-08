// Feuille de style autonome du dashboard exporté ; aucune police ni ressource distante.

export const dashboardStyles = String.raw`
:root {
  color-scheme: dark;
  --db-bg: var(--color-black, #0e0e12);
  --db-surface: var(--color-anthracite, #19191f);
  --db-raised: var(--color-anthracite-raised, #24242c);
  --db-input: var(--color-input, #101015);
  --db-text: var(--color-text, #f2f1f6);
  --db-muted: var(--color-text-muted, #b5b2c2);
  --db-border: var(--color-border, #ffffff24);
  --db-border-hover: var(--color-border-hover, #ffffff48);
  --db-primary: var(--color-yellow, #f5d547);
  --db-primary-hover: var(--color-yellow-hover, #ffe777);
  --db-primary-active: var(--color-yellow-active, #dbba30);
  --db-primary-soft: var(--color-yellow-soft, #f5d54718);
  --db-on-primary: var(--color-on-primary, #12110e);
  --db-secondary: var(--color-violet, #c4b1ff);
  --db-secondary-soft: var(--color-violet-soft, #c4b1ff18);
  --db-secondary-border: var(--color-violet-border, #c4b1ff88);
  --db-error: var(--color-error, #e05c6e);
  --db-warning: var(--color-warning, #d9a441);
  --db-success: var(--color-pure, #7fb069);
  --db-radius: 12px;
  --db-radius-small: 8px;
  --db-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --db-mono: ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
}

* { box-sizing: border-box; }

html, body { min-height: 100%; }

body {
  margin: 0;
  color: var(--db-text);
  background:
    radial-gradient(circle at 12% -8%, var(--db-primary-soft), transparent 34rem),
    radial-gradient(circle at 92% 4%, var(--db-secondary-soft), transparent 30rem),
    var(--db-bg);
  font-family: var(--db-font);
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}

button, input, select, textarea { font: inherit; }
button { color: inherit; }
p, h1, h2, h3 { margin: 0; }

.db-skip-link {
  position: absolute;
  left: -999px;
  top: 8px;
  z-index: 100;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--db-primary);
  color: var(--db-on-primary);
}
.db-skip-link:focus { left: 8px; }

.db-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 34px clamp(16px, 4vw, 48px) 18px;
}

.db-identity { min-width: 0; max-width: 820px; }
.db-eyebrow {
  margin: 0 0 10px;
  color: var(--db-primary);
  font-family: var(--db-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.db-title {
  margin: 0;
  font-size: clamp(30px, 5vw, 58px);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 0.98;
  overflow-wrap: anywhere;
}
.db-description {
  max-width: 74ch;
  margin: 14px 0 0;
  color: var(--db-muted);
  font-size: clamp(13px, 1.4vw, 16px);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.db-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.db-controls {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--db-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--db-surface) 82%, transparent);
}
.db-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--db-border);
  border-radius: 999px;
  background: transparent;
  color: var(--db-text);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
  cursor: pointer;
}
.db-button:hover:not(:disabled) { border-color: var(--db-border-hover); background: var(--db-primary-soft); }
.db-button:disabled { opacity: 0.4; cursor: not-allowed; }
.db-button--primary {
  border-color: transparent;
  background: var(--db-primary);
  color: var(--db-on-primary);
  font-weight: 800;
}
.db-button--primary:hover:not(:disabled) { background: var(--db-primary-hover); }
.db-button--primary:active:not(:disabled) { background: var(--db-primary-active); }
.db-button--quiet { border-color: transparent; }
.db-button:focus-visible,
.db-panel__handle:focus-visible,
.db-panel__hide:focus-visible,
.db-panel__resize:focus-visible,
.db-menu__reset:focus-visible,
.db-menu__item input:focus-visible {
  outline: 2px solid var(--db-secondary);
  outline-offset: 2px;
}

.db-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 0 clamp(16px, 4vw, 48px) 18px;
}
.db-status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 28px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.db-status__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--db-muted);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--db-muted) 12%, transparent);
}
.db-status[data-kind="running"] .db-status__dot { background: var(--db-success); animation: db-pulse 1.2s ease-in-out infinite; }
.db-status[data-kind="preparing"] .db-status__dot { background: var(--db-warning); animation: db-pulse 1.2s ease-in-out infinite; }
.db-status[data-kind="paused"] .db-status__dot { background: var(--db-warning); }
.db-status[data-kind="completed"] .db-status__dot { background: var(--db-success); }
.db-status[data-kind="error"] .db-status__dot { background: var(--db-error); }
.db-progress {
  flex: 1 1 120px;
  height: 3px;
  min-width: 80px;
  border-radius: 999px;
  background: var(--db-border);
  overflow: hidden;
}
.db-progress__fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--db-primary), var(--db-secondary));
  transition: width 0.15s linear;
}

.db-stage {
  display: grid;
  grid-template-columns: repeat(var(--db-columns, 12), minmax(0, 1fr));
  grid-auto-rows: 24px;
  gap: 12px;
  align-items: stretch;
  padding: 0 clamp(16px, 4vw, 48px) 36px;
}

.db-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius);
  background: linear-gradient(180deg, color-mix(in srgb, var(--db-raised) 94%, transparent), var(--db-surface));
  box-shadow: 0 12px 30px #0000001f;
  overflow: hidden;
}
.db-panel[hidden] { display: none !important; }
.db-panel--dragging { outline: 1px dashed var(--db-primary); outline-offset: 2px; }
.db-panel__header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--db-border);
  background: color-mix(in srgb, var(--db-raised) 72%, transparent);
  cursor: grab;
}
.db-panel__header:active { cursor: grabbing; }
.db-panel__handle,
.db-panel__hide {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--db-muted);
}
.db-panel__handle { cursor: grab; touch-action: none; }
.db-panel__handle:active { cursor: grabbing; }
.db-panel__handle:hover { color: var(--db-text); background: var(--db-primary-soft); }
.db-panel__hide { cursor: pointer; }
.db-panel__hide:hover { color: var(--db-error); background: color-mix(in srgb, var(--db-error) 14%, transparent); }
.db-panel__titles { flex: 1 1 auto; min-width: 0; }
.db-panel__title {
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-panel__kind {
  margin: 2px 0 0;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.db-panel__body {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}
.db-panel__body--stretch { display: block; padding: 10px; }
.db-panel__resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--db-muted);
  cursor: nwse-resize;
  opacity: 0.65;
  touch-action: none;
}
.db-panel__resize:hover { opacity: 1; background: var(--db-primary-soft); }

.db-screen { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 0; }
.db-screen canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
  background: #000;
  image-rendering: pixelated;
}

.db-led { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.db-led__dot {
  width: clamp(42px, 30%, 88px);
  max-width: 88px;
  aspect-ratio: 1;
  border: 1px solid var(--db-border);
  border-radius: 50%;
  background: var(--db-raised);
  box-shadow: inset 0 0 18px #00000066;
  transition: background 0.12s linear, box-shadow 0.12s linear;
}
.db-led__dot--on {
  background: var(--db-primary);
  box-shadow: 0 0 30px color-mix(in srgb, var(--db-primary) 70%, transparent), inset 0 0 10px #ffffff88;
}
.db-led__label { color: var(--db-muted); font-family: var(--db-mono); font-size: 11px; }

.db-gauge { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
.db-gauge svg { width: min(100%, 170px); overflow: visible; }
.db-gauge__track { fill: none; stroke: var(--db-border); stroke-linecap: round; stroke-width: 10; }
.db-gauge__value { fill: none; stroke: var(--db-primary); stroke-linecap: round; stroke-width: 10; transition: stroke-dasharray 0.12s linear; }
.db-gauge__number { font-family: var(--db-mono); font-size: clamp(16px, 2.5vw, 24px); font-weight: 700; }
.db-gauge__range {
  display: flex;
  justify-content: space-between;
  width: min(100%, 170px);
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
}

.db-progress-widget { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.db-progress-widget__track {
  height: 16px;
  border: 1px solid var(--db-border);
  border-radius: 999px;
  background: var(--db-input);
  overflow: hidden;
}
.db-progress-widget__fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--db-primary), var(--db-secondary));
  transition: width 0.12s linear;
}
.db-progress-widget__meta {
  display: flex;
  justify-content: space-between;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 11px;
}

.db-bars { position: relative; display: flex; align-items: stretch; gap: 3px; width: 100%; height: 100%; min-height: 40px; padding-top: 8px; }
.db-bars::before {
  content: '';
  position: absolute;
  right: 0;
  left: 0;
  top: var(--db-baseline, 100%);
  height: 1px;
  background: var(--db-border);
}
.db-bar { position: relative; flex: 1 1 0; min-width: 2px; height: 100%; }
.db-bar span {
  position: absolute;
  right: 0;
  left: 0;
  display: block;
  min-height: 2px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--db-primary), var(--db-secondary));
  transition: height 0.12s linear, bottom 0.12s linear, top 0.12s linear;
}
.db-bar span.db-bar__fill--negative { background: linear-gradient(180deg, var(--db-secondary), var(--db-primary)); }

.db-heatmap { display: grid; gap: 2px; width: 100%; height: 100%; }
.db-heatmap__cell {
  min-width: 0;
  min-height: 0;
  border-radius: 2px;
  background: var(--db-primary);
  opacity: 0;
  transition: opacity 0.12s linear;
}

.db-output {
  width: 100%;
  height: 100%;
  overflow: auto;
  font-family: var(--db-mono);
  font-size: 12px;
  line-height: 1.55;
}
.db-output__line {
  padding: 2px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--db-border) 45%, transparent);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.db-empty { color: var(--db-muted); font-size: 12px; text-align: center; }

.db-execution { display: flex; flex-direction: column; gap: 9px; width: 100%; }
.db-execution__step {
  color: var(--db-primary);
  font-family: var(--db-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.db-execution__name { font-size: clamp(16px, 2.4vw, 24px); font-weight: 750; overflow-wrap: anywhere; }
.db-execution__meta { display: flex; flex-wrap: wrap; gap: 5px 14px; color: var(--db-muted); font-family: var(--db-mono); font-size: 11px; }
.db-execution__empty { color: var(--db-muted); font-size: 12px; }

.db-menu { position: relative; }
.db-menu__popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: min(290px, calc(100vw - 32px));
  padding: 8px;
  border: 1px solid var(--db-border);
  border-radius: 12px;
  background: var(--db-raised);
  box-shadow: 0 18px 50px #00000066;
}
.db-menu__popover[hidden] { display: none; }
.db-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  color: var(--db-text);
  font-size: 12px;
  cursor: pointer;
}
.db-menu__item:hover { background: var(--db-primary-soft); }
.db-menu__item input { accent-color: var(--db-primary); }
.db-menu__reset {
  width: 100%;
  margin-top: 6px;
  padding: 10px 8px 6px;
  border: 0;
  border-top: 1px solid var(--db-border);
  background: transparent;
  color: var(--db-muted);
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.db-menu__reset:hover { color: var(--db-text); }

.db-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 0 clamp(16px, 4vw, 48px) 28px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

[dir="rtl"] .db-menu__popover { right: auto; left: 0; }
[dir="rtl"] .db-panel__resize { right: auto; left: 2px; }
[dir="rtl"] .db-menu__reset { text-align: right; }

@keyframes db-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@media (max-width: 760px) {
  .db-header { padding-top: 22px; }
  .db-actions { width: 100%; justify-content: flex-start; }
  .db-controls { flex: 1 1 auto; }
  .db-controls .db-button { flex: 1 1 0; padding: 0 10px; }
  .db-stage { gap: 8px; padding-left: 12px; padding-right: 12px; }
  .db-toolbar { padding-left: 12px; padding-right: 12px; }
  .db-footer { padding-left: 12px; padding-right: 12px; }
}

@media (max-width: 460px) {
  .db-title { font-size: 28px; }
  .db-panel__body { padding: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
`
