const AUTH_KEY = 'jobmatcherAuth'

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isSupportedJobBoardUrl(tab.url || '')) return
  await injectCaptureButton(tab.id)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !isSupportedJobBoardUrl(tab.url || '')) return
  void injectCaptureButton(tabId)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false

  if (message.type === 'JOBMATCHER_SAVE_AUTH') {
    const token = String(message.token || '')
    const appOrigin = String(message.appOrigin || '').replace(/\/+$/, '')
    if (!token || !/^https?:\/\//i.test(appOrigin)) {
      sendResponse({ ok: false, error: 'Invalid Jobmatcher connection.' })
      return false
    }

    chrome.storage.local.set({ [AUTH_KEY]: { token, appOrigin, connectedAt: Date.now() } }, () => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'JOBMATCHER_GET_AUTH') {
    chrome.storage.local.get(AUTH_KEY, (result) => {
      sendResponse({ ok: true, auth: result[AUTH_KEY] || null })
    })
    return true
  }

  if (message.type === 'JOBMATCHER_SAVE_JOB') {
    saveCapturedJob(message.payload).then(sendResponse)
    return true
  }

  return false
})

function isSupportedJobBoardUrl(url) {
  return /^https:\/\/([^/]+\.)?(linkedin|indeed|naukri)\.com\//i.test(String(url || ''))
}

async function injectCaptureButton(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    // Chrome surfaces injection failures in the extension console; keep the user page undisturbed.
  }
}

async function saveCapturedJob(payload) {
  const { [AUTH_KEY]: auth } = await chrome.storage.local.get(AUTH_KEY)
  if (!auth?.token || !auth?.appOrigin) {
    return { ok: false, error: 'Connect Jobmatcher first.' }
  }

  try {
    const response = await fetch(`${auth.appOrigin}/api/import-captured-job`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        reconnect: response.status === 401,
        error: data?.error?.message || 'Jobmatcher could not save this job.',
      }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Jobmatcher is not reachable.' }
  }
}
