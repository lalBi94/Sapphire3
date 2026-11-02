// Rasterise un document SVG en PNG (au double de la taille pour la netteté) et retourne ses octets.
export function rasterizeSvg(svg, width, height) {
  const failure = () => Object.assign(new Error('NODE_IMAGE_FAILED'), { code: 'NODE_IMAGE_FAILED' })
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') { reject(failure()); return }
    const image = new Image()
    image.onload = () => {
      try {
        const scale = 2
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const context = canvas.getContext('2d')
        context.scale(scale, scale)
        context.drawImage(image, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (!blob) { reject(failure()); return }
          blob.arrayBuffer().then(resolve).catch(() => reject(failure()))
        }, 'image/png')
      } catch {
        reject(failure())
      }
    }
    image.onerror = () => reject(failure())
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
