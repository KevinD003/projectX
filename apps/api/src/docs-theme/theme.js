/*
 * The Desi Events API reference: two things the stock Swagger UI page cannot
 * be told through its options, done from a script served by this host.
 *
 * 1. The page has no viewport declaration, so a phone lays it out 980px wide
 *    and the reader scrolls sideways. This adds one.
 * 2. Swagger UI ships a complete dark mode behind `html.dark-mode` and turns
 *    it on only from its own switch. This follows the reader's system setting
 *    instead, live, and `theme.css` maps that mode to the purple "Showtime"
 *    register.
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

  if (!window.matchMedia) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = function () {
    document.documentElement.classList.toggle('dark-mode', dark.matches)
  }
  apply()
  if (dark.addEventListener) dark.addEventListener('change', apply)
})()
