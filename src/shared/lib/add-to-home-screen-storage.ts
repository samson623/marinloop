// One-time migration: medflow_add_to_home_seen → marinloop_add_to_home_seen
if (typeof window !== 'undefined') {
  const _legacy = localStorage.getItem('medflow_add_to_home_seen')
  if (_legacy !== null && localStorage.getItem('marinloop_add_to_home_seen') === null) {
    localStorage.setItem('marinloop_add_to_home_seen', _legacy)
    localStorage.removeItem('medflow_add_to_home_seen')
  }
}

const ADD_TO_HOME_SEEN_KEY = 'marinloop_add_to_home_seen'

export function getAddToHomeScreenSeen(): boolean {
  try {
    return !!localStorage.getItem(ADD_TO_HOME_SEEN_KEY)
  } catch {
    return false
  }
}

export function setAddToHomeScreenSeen(): void {
  try {
    localStorage.setItem(ADD_TO_HOME_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}
