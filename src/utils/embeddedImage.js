// N'accepte que les images intégrées ; un workspace ne doit jamais déclencher de requête distante.
export function isEmbeddedImage(value) {
  return typeof value === 'string' && (value === '' || /^data:image\/(?:png|jpeg|gif|webp|bmp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=\s]+$/.test(value))
}
