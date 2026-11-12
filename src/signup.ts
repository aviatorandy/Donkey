const endpoint = import.meta.env.VITE_SIGNUP_ENDPOINT as string | undefined
const form = document.querySelector<HTMLFormElement>('#signup')!
const status = document.querySelector<HTMLParagraphElement>('#signup-status')!
const button = form.querySelector('button')!

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = new FormData(form).get('email')
  if (!endpoint) {
    status.textContent = 'Sign-ups are not connected yet. Set VITE_SIGNUP_ENDPOINT to collect them.'
    return
  }
  button.disabled = true
  status.textContent = 'Sending...'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) throw new Error(String(res.status))
    form.reset()
    status.textContent = "You're on the list. We'll be in touch."
  } catch {
    status.textContent = 'That did not go through. Please try again.'
  } finally {
    button.disabled = false
  }
})
