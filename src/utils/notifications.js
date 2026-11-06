export const notificationHistoryLimit = 20
export const notificationDedupeWindow = 2500

// Priorité par défaut : les erreurs passent devant les confirmations ordinaires.
const typePriorities = Object.freeze({
  loading: 20,
  info: 30,
  hidden_cards_restored: 35,
  success: 40,
  saved: 45,
  import_success: 40,
  export_success: 40,
  simulation_finished: 40,
  debug_paused: 50,
  locked_card: 50,
  update_available: 70,
  warning: 80,
  shortcut_conflict: 95,
  transpile_failed: 95,
  error: 100,
})

// Durée par défaut ; zéro garde la bulle jusqu'à interaction.
const typeDurations = Object.freeze({
  loading: 0,
  error: 0,
  warning: 0,
  shortcut_conflict: 0,
  transpile_failed: 0,
  update_available: 0,
  debug_paused: 9000,
  locked_card: 4000,
  hidden_cards_restored: 4000,
  saved: 3500,
  import_success: 4500,
  export_success: 4500,
  success: 4500,
  simulation_finished: 6000,
  info: 5000,
})

// Construit une notification complète et stable avant réduction.
export function normalizeNotification(input, id, now = Date.now()) {
  const type = input.type ?? 'info'
  return {
    id,
    type,
    title: input.title ?? '',
    message: input.message ?? '',
    key: input.key ?? '',
    priority: Number.isFinite(input.priority) ? input.priority : typePriorities[type] ?? 30,
    duration: Number.isFinite(input.duration) ? Math.max(0, input.duration) : typeDurations[type] ?? 5000,
    actions: Array.isArray(input.actions) ? input.actions.filter((action) => action && typeof action.label === 'string') : [],
    createdAt: now,
    updatedAt: now,
  }
}

// L'historique ne conserve que les informations utiles à la consultation.
function historyEntry(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    key: notification.key,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }
}

// Vérifie qu'une notification identique n'a pas déjà été présentée très récemment.
function isRecentDuplicate(state, notification) {
  const matches = (entry) => entry.type === notification.type
    && entry.title === notification.title
    && entry.message === notification.message
    && notification.createdAt - entry.createdAt < notificationDedupeWindow
  return state.items.some(matches) || state.history.some(matches)
}

// Réducteur pur de la file : une notification de progression remplace celle de même clé.
export function reduceNotifications(state, action) {
  if (action.type === 'notify') {
    const notification = action.notification
    const existing = notification.key ? state.items.find((entry) => entry.key === notification.key) : null
    if (existing) {
      const updated = { ...notification, id: existing.id, createdAt: existing.createdAt }
      const items = state.items.map((entry) => entry === existing ? updated : entry)
      const history = [historyEntry(updated), ...state.history.filter((entry) => entry.key !== notification.key)].slice(0, notificationHistoryLimit)
      return { items, history }
    }
    if (!notification.key && isRecentDuplicate(state, notification)) return state
    return {
      items: [...state.items, notification],
      history: [historyEntry(notification), ...state.history].slice(0, notificationHistoryLimit),
    }
  }
  if (action.type === 'dismiss') return { ...state, items: state.items.filter((entry) => entry.id !== action.id) }
  if (action.type === 'clear') return { items: [], history: [] }
  if (action.type === 'clearHistory') return { ...state, history: [] }
  return state
}

// Retourne la notification visible : priorité la plus haute, puis la plus ancienne.
export function activeNotification(items) {
  return items.reduce((current, entry) => {
    if (!current) return entry
    if (entry.priority !== current.priority) return entry.priority > current.priority ? entry : current
    return entry.createdAt < current.createdAt ? entry : current
  }, null)
}
