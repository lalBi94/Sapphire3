// Feuille de style autonome du dashboard exporté ; mêmes tokens et même géométrie que l'application.

export const dashboardStyles = String.raw`
:root {
  color-scheme: dark;
  --db-bg: var(--color-black, #0e0e12);
  --db-surface: var(--color-anthracite, #19191f);
  --db-raised: var(--color-anthracite-raised, #24242c);
  --db-text: var(--color-text, #f2f1f6);
  --db-muted: var(--color-text-muted, #b5b2c2);
  --db-border: var(--color-border, #ffffff24);
  --db-border-hover: var(--color-border-hover, #ffffff48);
  --db-hover: var(--color-hover, #ffffff0d);
  --db-grid: var(--color-grid, #ffffff0c);
  --db-edge: var(--color-canvas-edge, #07070b99);
  --db-primary: var(--color-yellow, #f5d547);
  --db-primary-hover: var(--color-yellow-hover, #ffe777);
  --db-primary-active: var(--color-yellow-active, #dbba30);
  --db-primary-soft: var(--color-yellow-soft, #f5d54718);
  --db-on-primary: var(--color-on-primary, #0e0e12);
  --db-secondary: var(--color-violet, #c4b1ff);
  --db-condition: var(--color-node-condition, #d9a441);
  --db-warning: var(--color-warning, #d9a441);
  --db-success: var(--color-pure, #7fb069);
  --db-diagnostic: var(--color-diagnostic, #f3b1a3);
  --db-font: 'Inter', system-ui, sans-serif;
  --db-display: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  --db-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
  --db-radius-small: 2px;
  --db-radius-control: 3px;
  --db-radius-panel: 5px;
  --db-corner: bevel;
  --db-panel-surface: var(--db-raised);
  --db-shadow-panel: 0 12px 28px color-mix(in srgb, black 42%, transparent), inset 0 0 0 1px #ffffff08;
  --db-duration: 120ms;
  --db-easing: ease-out;
  --db-focus: var(--color-focus, var(--db-primary));
}

* { box-sizing: border-box; }

html, body { min-height: 100%; }

body {
  margin: 0;
  color: var(--db-text);
  background:
    linear-gradient(var(--db-grid) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, var(--db-grid) 1px, transparent 1px) 0 0 / 40px 40px,
    radial-gradient(circle at 50% -12%, color-mix(in srgb, var(--db-primary) 7%, transparent), transparent 52rem),
    radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--db-secondary) 6%, transparent), transparent 38rem),
    var(--db-bg);
  background-attachment: fixed;
  font-family: var(--db-font);
  font-size: 12px;
  line-height: 1.5;
  box-shadow: inset 0 0 160px var(--db-edge);
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
  padding: 7px 10px;
  border: 1px solid var(--db-primary);
  border-radius: var(--db-radius-control);
  background: var(--db-bg);
  color: var(--db-primary);
  font-family: var(--db-display);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.db-skip-link:focus { left: 8px; }

.db-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px clamp(16px, 4vw, 40px) 18px;
  border-bottom: 1px solid var(--db-border);
  background: var(--db-bg);
}

.db-identity { min-width: 0; max-width: 820px; }
.db-title {
  margin: 0;
  color: var(--db-text);
  font-family: var(--db-display);
  font-size: clamp(30px, 5vw, 54px);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1;
  overflow-wrap: anywhere;
}
.db-description {
  max-width: 74ch;
  margin: 12px 0 0;
  color: var(--db-muted);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.db-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.db-controls,
.db-mode {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-control);
  background: color-mix(in srgb, var(--db-bg) 72%, transparent);
}
.db-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--db-radius-small);
  background: transparent;
  color: var(--db-muted);
  font-family: var(--db-display);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.db-button:hover:not(:disabled) {
  border-color: var(--db-border);
  background: var(--db-hover);
  color: var(--db-text);
}
.db-button:active:not(:disabled) { transform: translateY(1px); }
.db-button:disabled { opacity: 0.45; cursor: not-allowed; }
.db-button__icon {
  width: 13px;
  height: 13px;
  flex: none;
  transition: transform 0.15s ease;
}
.db-button:hover:not(:disabled) .db-button__icon { transform: scale(1.08); }
.db-button--primary {
  border-color: transparent;
  background: var(--db-primary);
  color: var(--db-on-primary);
  font-weight: 700;
}
.db-button--primary:hover:not(:disabled) {
  border-color: transparent;
  background: var(--db-primary-hover);
  color: var(--db-on-primary);
}
.db-button--primary:active:not(:disabled) { background: var(--db-primary-active); }
.db-mode__button[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--db-primary) 55%, transparent);
  background: var(--db-primary-soft);
  color: var(--db-primary);
}
.db-mode__button[aria-pressed="false"] { color: var(--db-muted); }
.db-controls { flex-wrap: wrap; }
.db-lang { position: relative; display: inline-flex; align-items: center; }
.db-lang::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 8px;
  width: 0;
  height: 0;
  border-top: 4px solid var(--db-muted);
  border-right: 3px solid transparent;
  border-left: 3px solid transparent;
  pointer-events: none;
  transform: translateY(-50%);
}
.db-lang__select {
  min-height: 30px;
  padding: 0 24px 0 9px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-small);
  background: var(--db-raised);
  color: var(--db-text);
  font-family: var(--db-font);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
.db-lang__select option {
  background: var(--db-raised);
  color: var(--db-text);
}
.db-lang__select option:checked {
  background: var(--db-raised);
  color: var(--db-primary);
}
.db-lang__select:hover {
  border-color: var(--db-border-hover);
  background: var(--db-raised);
  color: var(--db-text);
}
.db-lang__select:focus-visible {
  outline: 2px solid var(--db-focus);
  outline-offset: -2px;
}
[dir="rtl"] .db-lang::after { right: auto; left: 8px; }
[dir="rtl"] .db-lang__select { padding: 0 9px 0 24px; }
.db-button:focus-visible,
.db-panel__handle:focus-visible,
.db-panel__hide:focus-visible,
.db-panel__resize:focus-visible,
.db-menu__reset:focus-visible,
.db-menu__item input:focus-visible {
  outline: 2px solid var(--db-focus);
  outline-offset: -2px;
}

.db-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 9px clamp(16px, 4vw, 40px);
  border-bottom: 1px solid var(--db-border);
  background: var(--db-bg);
}
.db-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.db-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--db-muted);
}
.db-status[data-kind="running"] .db-status__dot { background: var(--db-success); animation: db-pulse 1.2s ease-in-out infinite; }
.db-status[data-kind="preparing"] .db-status__dot { background: var(--db-warning); animation: db-pulse 1.2s ease-in-out infinite; }
.db-status[data-kind="paused"] .db-status__dot { background: var(--db-warning); }
.db-status[data-kind="completed"] .db-status__dot { background: var(--db-success); }
.db-status[data-kind="error"] .db-status__dot { background: var(--db-diagnostic); }
.db-progress {
  position: relative;
  flex: 1 1 120px;
  height: 14px;
  min-width: 80px;
  border-radius: 0;
  background: transparent;
  direction: ltr;
}
.db-progress::before {
  content: '';
  position: absolute;
  top: 6px;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--db-border);
}
.db-progress:hover::before { background: var(--db-border-hover); }
.db-progress:focus-within { outline: 2px solid var(--db-focus); outline-offset: 2px; }
.db-progress__fill {
  position: absolute;
  top: 6px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--db-primary), var(--db-condition) 55%, var(--db-secondary));
  transition: width 0.15s linear;
  pointer-events: none;
}
.db-progress__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
.db-progress__input:disabled { cursor: default; }
.db-speed {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 2px 8px 2px 6px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-control);
  background: color-mix(in srgb, var(--db-bg) 72%, transparent);
}
.db-speed__label {
  padding: 0 2px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.db-speed__slider {
  width: clamp(72px, 12vw, 132px);
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  direction: ltr;
  appearance: none;
  -webkit-appearance: none;
}
.db-speed__slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 1px;
  background: linear-gradient(90deg, var(--db-primary) 0 var(--db-speed-progress, 0%), var(--db-border) var(--db-speed-progress, 0%) 100%);
}
.db-speed__slider::-webkit-slider-thumb {
  width: 11px;
  height: 11px;
  margin-top: -4px;
  border: 1px solid var(--db-primary);
  border-radius: 2px;
  background: var(--db-raised);
  appearance: none;
  -webkit-appearance: none;
}
.db-speed__slider::-moz-range-track {
  height: 3px;
  border-radius: 1px;
  background: var(--db-border);
}
.db-speed__slider::-moz-range-progress {
  height: 3px;
  border-radius: 1px;
  background: var(--db-primary);
}
.db-speed__slider::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: 1px solid var(--db-primary);
  border-radius: 2px;
  background: var(--db-raised);
}
.db-speed__slider:focus-visible {
  outline: 2px solid var(--db-focus);
  outline-offset: 2px;
}
.db-speed__value {
  min-width: 30px;
  color: var(--db-text);
  font-family: var(--db-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.db-feedback {
  position: fixed;
  right: clamp(14px, 4vw, 40px);
  bottom: 24px;
  z-index: 60;
  max-width: min(360px, calc(100vw - 28px));
  padding: 10px 14px 10px 16px;
  border: 1px solid var(--db-border);
  border-left: 2px solid var(--db-primary);
  border-radius: var(--db-radius-control);
  background: color-mix(in srgb, var(--db-raised) 94%, transparent);
  box-shadow: 0 12px 32px color-mix(in srgb, black 42%, transparent);
  color: var(--db-text);
  font-family: var(--db-mono);
  font-size: 10px;
  letter-spacing: 0.03em;
  line-height: 1.5;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.db-feedback[data-visible="true"] { opacity: 1; transform: translateY(0); }
[dir="rtl"] .db-feedback {
  right: auto;
  left: clamp(14px, 4vw, 40px);
  border-left: 1px solid var(--db-border);
  border-right: 2px solid var(--db-primary);
}

.db-stage {
  display: grid;
  grid-template-columns: repeat(var(--db-columns, 12), minmax(0, 1fr));
  grid-auto-rows: 24px;
  gap: 10px;
  align-items: stretch;
  padding: 16px clamp(16px, 4vw, 40px) 32px;
}

.db-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-panel);
  corner-shape: var(--db-corner);
  background: var(--db-panel-surface);
  box-shadow: var(--db-shadow-panel);
  overflow: hidden;
}
.db-panel[hidden] { display: none !important; }
.db-panel--dragging { outline: 1px dashed var(--db-primary); outline-offset: 2px; }
.db-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 8px 0 0;
  border-bottom: 1px solid var(--db-border);
  background: transparent;
  cursor: grab;
}
.db-panel__header:active { cursor: grabbing; }
.db-panel__handle,
.db-panel__hide {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--db-radius-small);
  background: transparent;
  color: var(--db-muted);
}
.db-panel__handle { margin-left: 8px; cursor: grab; touch-action: none; }
.db-panel__handle:hover,
.db-panel__hide:hover {
  border-color: var(--db-border);
  background: var(--db-hover);
  color: var(--db-text);
}
.db-panel__hide:hover { color: var(--db-diagnostic); }
.db-panel__titles { flex: 1 1 auto; min-width: 0; }
.db-panel__title {
  margin: 0;
  overflow: hidden;
  color: var(--db-text);
  font-family: var(--db-font);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-panel__kind {
  margin: 2px 0 0;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.db-panel__body {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}
.db-panel__body--stretch { display: block; padding: 10px; }
.db-panel__resize {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--db-radius-small);
  background: transparent;
  color: var(--db-muted);
  cursor: nwse-resize;
  opacity: 0.7;
  touch-action: none;
}
.db-panel__resize:hover { opacity: 1; background: var(--db-hover); color: var(--db-text); }

.db-panel--screen .db-panel__body { padding: 0; align-items: stretch; }
.db-screen { display: flex; flex-direction: column; gap: 0; width: 100%; height: 100%; min-height: 0; }
.db-screen__viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: block;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #000;
  box-shadow: none;
}
.db-screen canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  box-shadow: none;
}
.db-screen__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-top: 1px solid var(--db-border);
  background: var(--db-raised);
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.db-led { display: grid; place-items: center; align-content: center; gap: 10px; width: 100%; height: 100%; }
.db-led__dot {
  width: clamp(36px, 42%, 84px);
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--db-border) 90%, transparent);
  border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, color-mix(in srgb, var(--db-raised) 92%, white), var(--db-surface));
  box-shadow: inset 0 2px 8px rgb(0 0 0 / 45%), 0 1px 2px rgb(0 0 0 / 30%);
  transition: background var(--db-duration) var(--db-easing), box-shadow var(--db-duration) var(--db-easing), border-color var(--db-duration) var(--db-easing);
}
.db-led__dot--on {
  border-color: color-mix(in srgb, var(--db-primary) 70%, transparent);
  background: radial-gradient(circle at 36% 30%, color-mix(in srgb, white 55%, var(--db-primary)), var(--db-primary) 55%, color-mix(in srgb, var(--db-secondary) 55%, var(--db-primary)));
  box-shadow:
    0 0 10px color-mix(in srgb, var(--db-primary) 65%, transparent),
    0 0 26px color-mix(in srgb, var(--db-secondary) 38%, transparent),
    inset 0 0 10px color-mix(in srgb, white 30%, transparent);
}
.db-led__dot--rgb {
  border-color: color-mix(in srgb, var(--rgb-led-color, #000) 55%, var(--db-border));
  background: radial-gradient(
    circle at 36% 30%,
    color-mix(in srgb, white 45%, var(--rgb-led-color, #000)),
    var(--rgb-led-color, #000) 58%,
    color-mix(in srgb, black 32%, var(--rgb-led-color, #000))
  );
  box-shadow:
    0 0 var(--rgb-led-spread, 8px) color-mix(in srgb, var(--rgb-led-color, #000) 62%, transparent),
    inset 0 0 10px rgb(255 255 255 / 18%);
}
.db-led__label { color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; letter-spacing: 0.04em; }

.db-input { display: grid; place-items: center; align-content: center; gap: 8px; width: 100%; height: 100%; padding: 10px; }
.db-input__button {
  width: 100%;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-control);
  color: var(--db-text);
  background: linear-gradient(180deg, var(--db-raised), var(--db-surface));
  font-family: var(--db-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color var(--db-duration) var(--db-easing), background var(--db-duration) var(--db-easing), box-shadow var(--db-duration) var(--db-easing);
}
.db-input__button:hover { border-color: var(--db-border-hover); }
.db-input__button:focus-visible { outline: 2px solid var(--db-focus); outline-offset: 2px; }
.db-input__button--pressed {
  border-color: var(--db-primary);
  background: linear-gradient(180deg, color-mix(in srgb, var(--db-primary) 28%, var(--db-raised)), color-mix(in srgb, var(--db-primary) 14%, var(--db-surface)));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--db-primary) 40%, transparent), 0 0 12px color-mix(in srgb, var(--db-primary) 20%, transparent);
}
.db-input__label { color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }

.db-gauge { display: grid; place-items: center; width: 100%; height: 100%; min-height: 0; padding: 6px; }
.db-gauge svg { width: 100%; height: 100%; max-width: 260px; max-height: 260px; overflow: visible; }
.db-gauge__track { fill: none; stroke: color-mix(in srgb, var(--db-border) 65%, transparent); stroke-width: 13; stroke-linecap: round; }
.db-gauge__tick { stroke: color-mix(in srgb, var(--db-muted) 32%, transparent); stroke-width: 1.5; stroke-linecap: round; }
.db-gauge__value { fill: none; stroke-width: 13; stroke-linecap: round; transition: stroke-dasharray 120ms linear; }
.db-gauge__glow { fill: none; stroke-width: 13; stroke-linecap: round; opacity: 0.18; }
.db-gauge__readout { fill: var(--db-text); font-family: var(--db-display); font-size: 42px; font-weight: 600; letter-spacing: 0.01em; }
.db-gauge__percent { fill: var(--db-primary); font-family: var(--db-mono); font-size: 15px; font-weight: 500; }
.db-gauge__range { fill: var(--db-muted); font-family: var(--db-mono); font-size: 11px; }

.db-progress-widget { display: flex; flex-direction: column; justify-content: center; gap: 9px; width: 100%; height: 100%; padding: 2px; }
.db-progress-widget__track {
  position: relative;
  height: 18px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-small);
  background: var(--db-surface);
  box-shadow: inset 0 1px 3px #00000088;
  overflow: hidden;
}
.db-progress-widget__fill {
  position: absolute;
  inset: 2px auto 2px 2px;
  max-width: calc(100% - 4px);
  border-radius: var(--db-radius-small);
  background: linear-gradient(90deg, var(--db-primary), var(--db-condition) 55%, var(--db-secondary));
  transition: width 140ms ease-out;
}
.db-progress-widget__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.db-bars-widget { display: flex; flex-direction: column; gap: 6px; width: 100%; height: 100%; }
.db-bars {
  position: relative;
  flex: 1 1 auto;
  min-height: 62px;
  overflow: hidden;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-small);
  background: linear-gradient(180deg, color-mix(in srgb, var(--db-raised) 78%, transparent), var(--db-surface));
  box-shadow: inset 0 1px 4px #00000066;
}
.db-bars__plot {
  position: absolute;
  inset: 10px 12px;
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.db-bars__plot::before {
  content: '';
  position: absolute;
  z-index: 1;
  right: 0;
  left: 0;
  top: var(--db-baseline, 100%);
  height: 1px;
  background: color-mix(in srgb, var(--db-muted) 38%, transparent);
  pointer-events: none;
}
.db-bars__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.db-bar { position: relative; flex: 1 1 0; min-width: 0; height: 100%; }
.db-bar span {
  position: absolute;
  right: 0;
  left: 0;
  min-height: 2px;
  border-radius: 0;
  background: linear-gradient(180deg, var(--db-secondary), var(--db-primary) 58%, var(--db-condition));
  transition: height 140ms ease-out, top 140ms ease-out, bottom 140ms ease-out;
}
.db-bar span.db-bar__fill--negative { background: linear-gradient(0deg, var(--db-secondary), var(--db-primary) 58%, var(--db-condition)); }

.db-oscilloscope { display: flex; flex-direction: column; gap: 4px; width: 100%; height: 100%; min-height: 140px; }
.db-oscilloscope__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; }
.db-oscilloscope__control { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 5px; border: 1px solid var(--db-border); border-radius: var(--db-radius-control); color: var(--db-text); background: transparent; font: inherit; font-size: 10px; line-height: 1; cursor: pointer; }
.db-oscilloscope__control:hover { background: var(--db-hover); }
.db-oscilloscope__control:focus-visible { outline: 2px solid var(--db-primary); outline-offset: 1px; }
.db-oscilloscope__stretch { display: inline-flex; align-items: center; gap: 4px; color: var(--db-muted); font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; }
.db-oscilloscope__stretch input { width: 58px; accent-color: var(--db-primary); }
.db-oscilloscope__body { display: grid; grid-template-columns: minmax(150px, 0.34fr) minmax(0, 1fr); gap: 6px; flex: 1; min-height: 0; }
.db-oscilloscope__channels { display: flex; flex-direction: column; gap: 4px; min-height: 0; padding: 2px; overflow: auto; }
.db-oscilloscope__channel { display: grid; grid-template-columns: auto minmax(42px, 1fr) auto auto; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--db-border); border-radius: var(--db-radius-control); background: var(--db-surface); }
.db-oscilloscope__channel--off { opacity: 0.55; }
.db-oscilloscope__swatch { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1px #00000055; }
.db-oscilloscope__channel-name { overflow: hidden; color: var(--db-text); font-family: var(--db-display); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.db-oscilloscope__toggle { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 1px solid var(--db-border); border-radius: var(--db-radius-control); color: var(--db-muted); background: transparent; cursor: pointer; }
.db-oscilloscope__toggle:hover { background: var(--db-hover); }
.db-oscilloscope__icon { width: 12px; height: 12px; }
.db-oscilloscope__range { grid-column: 1 / -1; display: grid; grid-template-columns: 58px minmax(0, 1fr) 26px; align-items: center; gap: 4px; color: var(--db-muted); font-size: 9px; }
.db-oscilloscope__range b { color: var(--db-text); font-size: 9px; font-variant-numeric: tabular-nums; text-align: end; }
.db-oscilloscope__range input { min-width: 0; accent-color: var(--db-primary); }
.db-oscilloscope__chart-wrap { position: relative; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--db-border); border-radius: var(--db-radius-small); background: var(--db-surface); }
.db-oscilloscope__chart { position: absolute; inset: 0; }
.db-oscilloscope__chart .uplot { font-family: var(--db-mono); }
.db-oscilloscope__chart .u-hz .u-cursor-x,
.db-oscilloscope__chart .u-vt .u-cursor-y { border-color: var(--db-border-hover); }
.db-oscilloscope__chart .u-select { background: var(--db-primary-soft); }
.db-oscilloscope__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 12px; color: var(--db-muted); font-size: 10px; text-align: center; pointer-events: none; }
.db-oscilloscope__readout { margin: 0; overflow: hidden; color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.db-oscilloscope__expand { position: absolute; z-index: 2; top: 4px; left: 4px; display: none; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--db-border); border-radius: var(--db-radius-control); color: var(--db-text); background: var(--db-raised); cursor: pointer; }
.db-oscilloscope--collapsed .db-oscilloscope__toolbar,
.db-oscilloscope--collapsed .db-oscilloscope__channels,
.db-oscilloscope--collapsed .db-oscilloscope__readout { display: none; }
.db-oscilloscope--collapsed .db-oscilloscope__body { grid-template-columns: minmax(0, 1fr); }
.db-oscilloscope--collapsed .db-oscilloscope__expand { display: inline-flex; }
.db-xyplot { position: relative; display: flex; flex-direction: column; gap: 4px; width: 100%; height: 100%; min-height: 120px; }
.db-xyplot__chart { position: relative; flex: 1; min-height: 0; overflow: hidden; border: 1px solid var(--db-border); border-radius: var(--db-radius-small); background: var(--db-surface); }
.db-xyplot__chart .uplot { font-family: var(--db-mono); }
.db-xyplot__chart .u-hz .u-cursor-x,
.db-xyplot__chart .u-vt .u-cursor-y { border-color: var(--db-border-hover); }
.db-xyplot__chart .u-select { background: var(--db-primary-soft); }
.db-xyplot__empty { position: absolute; inset: 0 0 18px; display: grid; place-items: center; margin: 0; padding: 12px; color: var(--db-muted); font-size: 10px; text-align: center; pointer-events: none; }
.db-xyplot__readout { margin: 0; overflow: hidden; color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.db-oscilloscope__empty[hidden],
.db-xyplot__empty[hidden] { display: none; }
.db-comment { width: 100%; height: 100%; overflow: auto; color: var(--db-text); font-family: var(--db-mono); font-size: 11px; line-height: 1.55; }
.db-comment__text { white-space: pre-wrap; overflow-wrap: anywhere; }
.db-comment__math { display: block; margin: 0.35em 0; overflow-x: auto; overflow-y: hidden; font-size: 1.05em; }
.db-comment__math .katex-display { margin: 0; }
.db-heatmap { display: grid; gap: 2px; width: 100%; height: 100%; min-height: 40px; }
.db-heatmap__cell {
  min-width: 0;
  min-height: 0;
  border-radius: 0;
  background: color-mix(in srgb, var(--db-primary) var(--db-heat, 0%), var(--db-raised));
}

.db-output {
  width: 100%;
  height: 100%;
  padding: 8px;
  overflow: auto;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-small);
  background: var(--db-raised);
  color: var(--db-text);
  font-family: var(--db-mono);
  font-size: 11px;
  line-height: 1.55;
}
.db-output__line {
  padding: 1px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--db-border) 45%, transparent);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.db-empty { color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; text-align: center; }
.db-contracts { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--db-border); }
.db-contracts h3 { margin: 0 0 6px; color: var(--db-text); font-family: var(--db-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
.db-contracts p { margin: 0; color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; }
.db-contracts ul { display: grid; gap: 4px; margin: 6px 0 0; padding: 0; list-style: none; }
.db-contracts li { padding: 5px 6px; border: 1px solid var(--db-diagnostic); border-radius: var(--db-radius-small); color: var(--db-diagnostic); font-family: var(--db-mono); font-size: 10px; line-height: 1.45; }

.db-execution { display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; min-height: 0; }
.db-map {
  flex: 1 1 auto;
  min-height: 160px;
  padding: 6px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-small);
  background: color-mix(in srgb, var(--db-bg) 42%, transparent);
}
.db-map__svg { display: block; width: 100%; height: 100%; overflow: visible; }
.db-map__edge { fill: none; stroke: var(--db-border-hover); stroke-width: 1.4; }
.db-map__arrow { fill: var(--db-border-hover); }
.db-map__box rect { fill: var(--db-raised); stroke: var(--db-border); stroke-width: 1.2; }
.db-map__box--class rect { stroke-dasharray: 4 3; }
.db-map__box text { fill: var(--db-text-muted); font-family: var(--db-mono); font-size: 10px; }
.db-map__box--active rect { fill: var(--db-primary-soft); stroke: var(--db-primary); stroke-width: 1.8; }
.db-map__box--active text { fill: var(--db-primary); }
.db-execution__step {
  color: var(--db-primary);
  font-family: var(--db-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.db-execution__name { color: var(--db-text); font-family: var(--db-display); font-size: clamp(14px, 1.8vw, 18px); font-weight: 600; overflow-wrap: anywhere; }
.db-execution__meta { display: flex; flex-wrap: wrap; gap: 5px 12px; color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; }
.db-execution__empty { color: var(--db-muted); font-family: var(--db-mono); font-size: 10px; }

.db-menu { position: relative; }
.db-menu__popover {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 20;
  width: min(290px, calc(100vw - 32px));
  padding: 4px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-control);
  corner-shape: var(--db-corner);
  background: var(--db-panel-surface);
  box-shadow: var(--db-shadow-panel);
}
.db-menu__popover[hidden] { display: none; }
.db-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--db-radius-small);
  color: var(--db-text);
  font-size: 11px;
  cursor: pointer;
}
.db-menu__item:hover { background: var(--db-hover); }
.db-menu__item input { accent-color: var(--db-primary); }
.db-menu__reset {
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: 0;
  border-top: 1px solid var(--db-border);
  background: transparent;
  color: var(--db-muted);
  font-family: var(--db-display);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  cursor: pointer;
}
.db-menu__reset:hover { color: var(--db-text); }

.db-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px clamp(16px, 4vw, 40px) 24px;
  border-top: 1px solid var(--db-border);
  color: var(--db-muted);
  font-family: var(--db-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.db-footer__brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.db-footer__logo {
  flex: none;
  width: 40px;
  height: 40px;
  padding: 4px;
  border: 1px solid var(--db-border);
  border-radius: var(--db-radius-control);
  background: color-mix(in srgb, var(--db-raised) 72%, transparent);
  object-fit: contain;
}
.db-footer__logo--fallback {
  display: grid;
  place-items: center;
  color: var(--db-primary);
  font-family: var(--db-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.db-footer__name {
  margin: 0;
  color: var(--db-text);
  font-family: var(--db-display);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: none;
}
.db-footer__version {
  color: var(--db-primary);
  font-family: var(--db-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.db-footer__tagline {
  margin: 2px 0 0;
  color: var(--db-muted);
  font-family: var(--db-font);
  font-size: 10px;
  letter-spacing: 0;
  text-transform: none;
}
.db-footer__credits { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.db-footer__credit { margin: 0; color: var(--db-muted); }
.db-footer__threadlock {
  margin: 0;
  color: var(--db-text);
  font-family: var(--db-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: none;
}
.db-footer__meta { margin: 0; color: var(--db-muted); }
.db-github {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  padding: 6px 9px;
  border: 1px solid #30363d;
  border-radius: var(--db-radius-control);
  background: #0d1117;
  color: #e6edf3;
  font-family: var(--db-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.db-github:hover {
  border-color: #8b949e;
  background: #161b22;
  color: #ffffff;
}
.db-github:focus-visible {
  outline: 2px solid var(--db-focus);
  outline-offset: 2px;
}
.db-github__icon { width: 14px; height: 14px; flex: none; }
.db-github__repo { color: inherit; }

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
[dir="rtl"] .db-panel__resize { right: auto; left: 3px; }
[dir="rtl"] .db-menu__reset { text-align: right; }
[dir="rtl"] .db-footer__credits { align-items: flex-start; text-align: left; }

@keyframes db-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@media (max-width: 760px) {
  .db-header { padding-top: 16px; }
  .db-actions { width: 100%; justify-content: flex-start; }
  .db-controls { flex: 1 1 auto; }
  .db-controls .db-button { flex: 1 1 0; padding: 0 8px; }
  .db-stage { gap: 8px; padding-left: 12px; padding-right: 12px; }
  .db-toolbar { padding-left: 12px; padding-right: 12px; }
  .db-footer { padding-left: 12px; padding-right: 12px; }
  .db-footer__credits { align-items: flex-start; text-align: left; }
  .db-feedback { right: 12px; bottom: 16px; left: 12px; max-width: none; }
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

@media (prefers-contrast: more), (forced-colors: active) {
  .db-button--primary { background: var(--db-primary); color: var(--db-on-primary); border-color: currentColor; }
  .db-led__dot--on { background: var(--db-primary); box-shadow: none; border-color: currentColor; }
  .db-led__dot--rgb { background: var(--rgb-led-color, #000); box-shadow: none; border-color: currentColor; }
  .db-gauge__glow { display: none; }
  .db-gauge__value { stroke: currentColor; }
  .db-progress__fill,
  .db-progress-widget__fill,
  .db-bar span { background: var(--db-primary); }
}
`
