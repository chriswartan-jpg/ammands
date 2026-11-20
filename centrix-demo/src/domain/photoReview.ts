import { formatMoney } from './format.ts'

export interface PhotoReview {
  finding: string
  estimate: { lowCents: number; highCents: number } | null
}

export function formatPhotoEstimate(estimate: NonNullable<PhotoReview['estimate']>): string {
  return `${formatMoney(estimate.lowCents)}–${formatMoney(estimate.highCents)}`
}
