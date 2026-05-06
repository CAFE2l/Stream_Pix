const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export interface CloudinaryUploadResult {
  secureUrl: string
  publicId: string
  resourceType: string
  format: string
  bytes: number
  duration?: number
}

function getResourceFolder(fileType: string): string {
  if (fileType.startsWith('audio/')) return 'stream-pix/audio'
  if (fileType.startsWith('video/')) return 'stream-pix/video'
  return 'stream-pix/misc'
}

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary não configurado. Adicione VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env')
  }

  const folder = getResourceFolder(file.type)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Cloudinary] Upload failed: ${error}`)
    throw new Error(`Erro no upload Cloudinary: ${error}`)
  }

  const data = await response.json()

  if (!data.secure_url || !data.public_id) {
    console.error('[Cloudinary] Missing secure_url or public_id in response')
    throw new Error('Cloudinary não retornou dados completos')
  }

  let secureUrl = data.secure_url

  if (data.resource_type === 'video') {
    const parts = secureUrl.split('/upload/')
    if (parts.length === 2) {
      secureUrl = `${parts[0]}/upload/f_auto,q_auto:good/${parts[1]}`
    }
  }

  const result: CloudinaryUploadResult = {
    secureUrl,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    bytes: data.bytes,
    duration: data.duration ? Math.round(data.duration) : undefined,
  }

  console.log(`[Cloudinary] Upload complete: ${result.secureUrl}`)

  return result
}
