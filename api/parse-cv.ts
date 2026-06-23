import Busboy from 'busboy'
import type { IncomingMessage, ServerResponse } from 'node:http'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { parseCvText } from '../src/lib/cvParser.js'
import { sanitiseParsedCv } from '../src/lib/security.js'
import {
  assertSafeContentType,
  enforceRateLimit,
  handleOptions,
  requireMethod,
  sanitiseFilename,
  sendError,
  sendJson,
  setCors,
} from './security.js'

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
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    enforceRateLimit(req, 'parse-cv', 10, 15 * 60_000)
    assertSafeContentType(req, 'multipart/form-data')
    const upload = await readMultipartFile(req)
    validateUpload(upload)
    const text = await extractText(upload)
    const parsed = sanitiseParsedCv(parseCvText(text, upload.filename))
    sendJson(res, 200, { cv: parsed })
  } catch (error) {
    sendError(res, error, 'CV_PARSE_ERROR')
  }
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
        fields: 0,
        parts: 1,
        fileSize: MAX_FILE_SIZE,
        headerPairs: 20,
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
          filename: sanitiseFilename(filename || 'uploaded-cv'),
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
