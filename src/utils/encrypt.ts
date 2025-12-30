import CryptoJS from 'crypto-js'

export function encrypt(text: string, secret: string): string {
  return CryptoJS.AES.encrypt(text, secret).toString()
}

export function decrypt(cipher: string, secret: string): string {
  const bytes = CryptoJS.AES.decrypt(cipher, secret)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export function toKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, 8) + '...'
}

