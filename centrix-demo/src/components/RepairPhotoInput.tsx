import { useId, useState } from 'react'

import type { RepairPhoto } from '../domain/caseFlow.ts'

const SAMPLE_ESTIMATES = [
  { value: '27500', label: 'Minor repair · €275' },
  { value: '385000', label: 'Major repair · €3,850' },
  { value: 'unknown', label: 'Photo inconclusive · no estimate' },
]

async function resizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 10 MB.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo processing is unavailable.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.76)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function RepairPhotoInput({ photo, setPhoto, reading, setReading }: {
  photo?: RepairPhoto
  setPhoto: (photo?: RepairPhoto) => void
  reading: boolean
  setReading: (reading: boolean) => void
}) {
  const id = useId()
  const [error, setError] = useState('')

  return (
    <fieldset className="repair-photo-input">
      <legend className="field-label">Add a photo of the damage</legend>
      <p className="muted" id={`${id}-help`}>
        Take a photo only if it’s safe. An attached photo will be shared with the assigned plumber.
      </p>
      <input id={id} type="file" accept="image/*" aria-label="Repair photo" aria-describedby={`${id}-help`} disabled={reading} onChange={async (event) => {
        const input = event.currentTarget
        const file = input.files?.[0]
        if (!file) return
        input.value = ''
        setError('')
        setReading(true)
        try {
          setPhoto({ dataUrl: await resizePhoto(file), estimateCents: Number(SAMPLE_ESTIMATES[0].value) })
        } catch {
          setError('Could not open this photo. Try a supported image under 10 MB.')
        } finally {
          setReading(false)
        }
      }} />
      {reading && <p role="status">Preparing photo…</p>}
      {error && <p role="alert">{error}</p>}
      {photo && (
        <>
          <img className="repair-photo" src={photo.dataUrl} alt="Repair photo preview" />
          <label className="field-label" htmlFor={`${id}-estimate`}>Simulated photo estimate</label>
          <select id={`${id}-estimate`} value={photo.estimateCents ?? 'unknown'} onChange={(event) => {
            const value = event.target.value
            setPhoto({ ...photo, estimateCents: value === 'unknown' ? null : Number(value) })
          }}>
            {SAMPLE_ESTIMATES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn btn-secondary" type="button" disabled={reading} onClick={() => setPhoto(undefined)}>Remove photo</button>
        </>
      )}
    </fieldset>
  )
}
