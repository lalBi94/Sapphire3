import { Download, LayoutDashboard } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { dashboardPaletteFromTheme, defaultDashboardConfig } from '../../utils/dashboardConfig.js'
import './WebDashboardSection.css'

// Section Settings > Export : nom, description, palette et génération du dashboard autonome.
export default function WebDashboardSection({ dashboard, onChangeDashboard, onExportDashboard, dashboardExporting = false, busy = false, pendingImport = false, project, diagnostics = [], widgetCount = 0 }) {
  const { t } = useTranslation()
  const { presetThemes, customThemes } = useTheme()
  const config = dashboard ?? defaultDashboardConfig()
  const themes = [...presetThemes, ...customThemes]
  const selectedTheme = themes.find((entry) => entry.id === config.themeId) ?? null
  const palette = selectedTheme?.colors ?? config.palette ?? presetThemes[0]?.colors ?? {}
  const entry = (project?.nodes ?? []).find((node) => node?.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const disabled = busy || pendingImport || dashboardExporting || !entry || errors > 0

  // Met à jour un champ sans modifier la source logique du projet.
  function update(patch) {
    onChangeDashboard({ ...config, ...patch })
  }

  // Mémorise la palette sombre du thème choisi pour la rendre portable dans le workspace.
  function chooseTheme(themeId) {
    const theme = themes.find((entry) => entry.id === themeId)
    if (!theme) return
    update({ themeId: theme.id, palette: dashboardPaletteFromTheme(theme.colors) })
  }

  return <div className="settings-section dashboard-export">
    <div className="dashboard-export__intro">
      <LayoutDashboard size={20} aria-hidden="true" />
      <div>
        <p className="settings-section__subtitle">{t('settings.section.webDashboard')}</p>
        <p className="settings-section__hint">{t('dashboard.exportHint')}</p>
      </div>
    </div>

    <label className="dashboard-export__field">
      <span>{t('dashboard.name')}</span>
      <input type="text" maxLength={80} value={config.name} onChange={(event) => update({ name: event.target.value })} />
    </label>

    <label className="dashboard-export__field">
      <span>{t('dashboard.description')}</span>
      <textarea maxLength={400} rows={4} placeholder={t('dashboard.descriptionPlaceholder')} value={config.description} onChange={(event) => update({ description: event.target.value })} />
    </label>

    <label className="dashboard-export__field">
      <span>{t('dashboard.theme')}</span>
      <select value={selectedTheme?.id ?? (config.palette ? '__custom' : presetThemes[0]?.id ?? '')} onChange={(event) => chooseTheme(event.target.value)}>
        {presetThemes.length > 0 && <optgroup label={t('theme.choose')}>
          {presetThemes.map((theme) => <option key={theme.id} value={theme.id}>{t(theme.labelKey)}</option>)}
        </optgroup>}
        {customThemes.length > 0 && <optgroup label={t('theme.custom')}>
          {customThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
        </optgroup>}
        {config.palette && !selectedTheme && <option value="__custom">{t('dashboard.customPalette')}</option>}
      </select>
    </label>

    <div className="dashboard-export__swatches" aria-hidden="true">
      {[palette['--color-black'], palette['--color-anthracite-raised'], palette['--color-yellow'], palette['--color-violet'], palette['--color-text']].filter(Boolean).map((color, index) => (
        <span key={`${color}-${index}`} className="dashboard-export__swatch" style={{ background: color }} />
      ))}
    </div>
    <p className="settings-section__hint">{t('dashboard.paletteHint')}</p>

    <div className="dashboard-export__meta">
      <span>{t('dashboard.widgetCount', { count: widgetCount })}</span>
      <span>{t('dashboard.offline')}</span>
    </div>

    {errors > 0
      ? <p className="dashboard-export__status dashboard-export__status--warning">{t('dashboard.blockingDiagnostics')}</p>
      : !entry
        ? <p className="dashboard-export__status dashboard-export__status--warning">{t('dashboard.noEntry')}</p>
        : <p className="dashboard-export__status dashboard-export__status--ready">{t('dashboard.entryPoint', { name: entry.properties.name })} · {t('dashboard.ready')}</p>}

    <div className="settings-section__actions">
      <button type="button" className="settings-section__primary" disabled={disabled} onClick={onExportDashboard}>
        <Download size={14} aria-hidden="true" />
        {dashboardExporting ? t('dashboard.exporting') : t('dashboard.export')}
      </button>
    </div>
    {dashboardExporting && <p className="settings-section__hint">{t('dashboard.preflight')}</p>}
    <p className="settings-section__hint">{t('dashboard.layoutHint')}</p>
    <p className="settings-section__hint">{t('dashboard.offlineHint')}</p>
  </div>
}
