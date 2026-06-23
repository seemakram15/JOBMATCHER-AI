(() => {
  try {
    const saved = localStorage.getItem('jobmatcher-theme')
    document.documentElement.classList.add(saved === 'light' ? 'light' : 'dark')
  } catch {
    document.documentElement.classList.add('dark')
  }
})()
