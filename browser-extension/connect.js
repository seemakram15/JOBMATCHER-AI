window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data || {}
  if (data.type !== 'JOBMATCHER_CONNECT_EXTENSION') return

  chrome.runtime.sendMessage(
    {
      type: 'JOBMATCHER_SAVE_AUTH',
      token: data.token,
      appOrigin: data.appOrigin || window.location.origin,
    },
    (response) => {
      window.postMessage(
        {
          type: 'JOBMATCHER_EXTENSION_CONNECTED',
          ok: Boolean(response?.ok),
          error: response?.error || '',
        },
        window.location.origin,
      )
    },
  )
})
