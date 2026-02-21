const ADD_TO_HOME_SEEN_KEY = 'medflow_add_to_home_seen'

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
