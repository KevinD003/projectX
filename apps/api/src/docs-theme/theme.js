/*
 * The Desi Events API reference: three things the stock Swagger UI page
 * cannot be told through its options, done from a script served by this host.
 *
 * 1. The page has no viewport declaration, so a phone lays it out 980px wide
 *    and the reader scrolls sideways. This adds one.
 * 2. Swagger UI ships a complete dark mode behind `html.dark-mode` and turns
 *    it on only from its own switch. This follows the reader's system setting
 *    instead, live, and `theme.css` maps that mode to the purple "Showtime"
 *    register.
 * 3. Three of the controls Swagger UI draws have no accessible name, which
 *    WCAG 2.2 level A requires (4.1.2, 1.1.1): the logo in the bar (an image
 *    with no `alt`, inside the link back to the top), the light and dark
 *    switch (an icon button), and the server picker (a select with no
 *    label). This names each as Swagger UI draws it, and says whether dark
 *    mode is on. Swagger UI re-renders, so the names are checked again after
 *    every change to the page rather than once.
 *
 * It stores nothing and sends nothing anywhere.
 */

/* global window, document */

;(function () {
  const head = document.head
  if (head && !document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width, initial-scale=1'
    head.appendChild(meta)
  }

  const root = document.documentElement

  /* What each unnamed control is called: [selector, attribute, name]. */
  const NAMES = [
    ['.swagger-ui .topbar img', 'alt', 'The Desi Events API'],
    ['.swagger-ui .dark-mode-toggle button', 'aria-label', 'Dark mode'],
    ['.swagger-ui select#servers', 'aria-label', 'Server'],
  ]

  const name = function () {
    for (const [selector, attribute, value] of NAMES) {
      for (const element of document.querySelectorAll(selector)) {
        if (!element.getAttribute(attribute)) element.setAttribute(attribute, value)
      }
    }
    const on = String(root.classList.contains('dark-mode'))
    for (const toggle of document.querySelectorAll('.swagger-ui .dark-mode-toggle button')) {
      if (toggle.getAttribute('aria-pressed') !== on) toggle.setAttribute('aria-pressed', on)
    }
  }

  if (window.MutationObserver) {
    new window.MutationObserver(name).observe(root, { childList: true, subtree: true })
    new window.MutationObserver(name).observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }
  name()

  if (!window.matchMedia) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = function () {
    root.classList.toggle('dark-mode', dark.matches)
  }
  apply()
  if (dark.addEventListener) dark.addEventListener('change', apply)
})()
