import Busboy from 'busboy'
import type { IncomingMessage, ServerResponse } from 'node:http'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { parseCvText } from '../src/lib/cvParser'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const allowedExtensions = new Set(['pdf', 'docx', 'doc', 'txt'])
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/octet-stream',
])

interface UploadedFile {
  buffer: Buffer
  filename: string
  mimeType: string
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST multipart/form-data.' } })
    return
  }

  try {
    const upload = await readMultipartFile(req)
    validateUpload(upload)
    const text = await extractText(upload)
    const parsed = parseCvText(text, upload.filename)
    sendJson(res, 200, { cv: parsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse CV'
    const code = /file|format|size|multipart/i.test(message) ? 400 : 500
    sendJson(res, code, {
      error: {
        code: code === 400 ? 'CV_PARSE_VALIDATION_ERROR' : 'CV_PARSE_ERROR',
        message,
      },
    })
  }
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readMultipartFile(req: IncomingMessage) {
  return new Promise<UploadedFile>((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data upload.'))
      return
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_FILE_SIZE,
      },
    })

    let uploaded: UploadedFile | null = null
    let fileTooLarge = false

    busboy.on('file', (_fieldName, file, info) => {
      const chunks: Uint8Array[] = []
      const { filename, mimeType } = info

      file.on('data', (chunk: Uint8Array) => chunks.push(chunk))
      file.on('limit', () => {
        fileTooLarge = true
        file.resume()
      })
      file.on('end', () => {
        uploaded = {
          buffer: Buffer.concat(chunks),
          filename: filename || 'uploaded-cv',
          mimeType: mimeType || 'application/octet-stream',
        }
      })
    })

    busboy.on('error', reject)
    busboy.on('finish', () => {
      if (fileTooLarge) {
        reject(new Error('CV file exceeds the 5MB limit.'))
        return
      }
      if (!uploaded) {
        reject(new Error('No CV file was uploaded.'))
        return
      }
      resolve(uploaded)
    })

    req.pipe(busboy)
  })
}

function validateUpload(upload: UploadedFile) {
  const extension = getExtension(upload.filename)
  if (!allowedExtensions.has(extension)) {
    throw new Error('Unsupported file format. Upload PDF, DOCX, DOC, or TXT.')
  }
  if (!allowedMimeTypes.has(upload.mimeType)) {
    throw new Error(`Unsupported MIME type: ${upload.mimeType}`)
  }
}

async function extractText(upload: UploadedFile) {
  const extension = getExtension(upload.filename)

  if (extension === 'pdf') {
    const parsed = await pdfParse(upload.buffer)
    return parsed.text
  }

  if (extension === 'docx' || extension === 'doc') {
    const parsed = await mammoth.extractRawText({ buffer: upload.buffer })
    return parsed.value
  }

  return upload.buffer.toString('utf8')
}

function getExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || ''
}
