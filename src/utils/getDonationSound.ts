export function getDonationSound(amount: number): string {
  if (amount <= 10) return '/sounds/donate.mp3'
  if (amount <= 25) return '/sounds/medium_donate.mp3'
  return '/sounds/super_donate.mp3'
}
