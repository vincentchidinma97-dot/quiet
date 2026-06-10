import * as Haptics from 'expo-haptics'

export function useHaptic() {
  return {
    light:  () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy:  () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  }
}
