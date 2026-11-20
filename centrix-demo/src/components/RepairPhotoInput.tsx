import { useEffect, useId, useRef, useState } from 'react'

import type { RepairPhoto } from '../domain/caseFlow.ts'
import { formatPhotoEstimate } from '../domain/photoReview.ts'
import type { PhotoReview } from '../domain/photoReview.ts'

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
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function reviewPhoto(file: File) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setError('')
    setReading(true)
    try {
      let dataUrl: string
      try {
        dataUrl = await resizePhoto(file)
      } catch {
        if (!controller.signal.aborted) setError('Could not open this photo. Try a supported image under 10 MB.')
        return
      }
      if (controller.signal.aborted) return
      setPhoto({ dataUrl })

      const response = await fetch('/api/photo-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      })
      if (!response.ok) throw new Error('Photo review unavailable')
      const review: PhotoReview = await response.json()
      if (!controller.signal.aborted) setPhoto({ dataUrl, review })
    } catch {
      if (!controller.signal.aborted) {
        setError('Automatic review is unavailable. You can still send the photo to the property manager.')
      }
    } finally {
      request.current = null
      if (!controller.signal.aborted) setReading(false)
    }
  }

  return (
    <fieldset className="repair-photo-input">
      <legend className="field-label">Add a photo of the damage</legend>
      <p className="muted" id={`${id}-help`}>
        Take a photo only if it’s safe. Selecting a photo sends it to OpenAI for review. If a plumber is assigned, they can see the photo.
      </p>
      <input id={id} type="file" accept="image/*" aria-label="Repair photo" aria-describedby={`${id}-help`} disabled={reading} onChange={async (event) => {
        const input = event.currentTarget
        const file = input.files?.[0]
        if (!file) return
        input.value = ''
        await reviewPhoto(file)
      }} />
      {reading && <p role="status">Reviewing the photo…</p>}
      {error && <p role="alert">{error}</p>}
      {photo && (
        <>
          <img className="repair-photo" src={photo.dataUrl} alt="Repair photo preview" />
          {photo.review && (
            <div role="status">
              <p><strong>AI photo review</strong></p>
              <p>{photo.review.finding}</p>
              <p className="muted">{photo.review.estimate
                ? `Estimated total ${formatPhotoEstimate(photo.review.estimate)}. The final price may differ.`
                : 'The photo does not support a cost estimate. The property manager will review the report.'}</p>
            </div>
          )}
          <button className="btn btn-secondary" type="button" disabled={reading} onClick={() => {
            setPhoto(undefined)
            setError('')
          }}>Remove photo</button>
        </>
      )}
    </fieldset>
  )
}
