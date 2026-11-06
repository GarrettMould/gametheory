export const ADMIN_PIN = '975999'

const LAB_UNLOCK_KEY = 'arena-lab-unlocked'

export function isLabUnlocked() {
  try {
    return sessionStorage.getItem(LAB_UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockLab() {
  try {
    sessionStorage.setItem(LAB_UNLOCK_KEY, '1')
  } catch {
    // Private browsing can block sessionStorage; in-memory unlock still works.
  }
}
