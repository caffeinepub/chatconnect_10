// Haptic feedback utilities using the Vibration API

export function vibrateShort() {
  try {
    navigator.vibrate?.(50);
  } catch {
    // ignore – API not available
  }
}

export function vibrateLong() {
  try {
    navigator.vibrate?.([100, 50, 100]);
  } catch {
    // ignore – API not available
  }
}
