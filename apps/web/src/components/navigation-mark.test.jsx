import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/events' }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

const { NavigationMark, markNavigated } = await import('./navigation-mark.jsx')

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.navigated
  navigation.pathname = '/events'
})

describe('NavigationMark', () => {
  it('leaves the first page of a visit unmarked, so its poster prints itself', () => {
    render(<NavigationMark />)

    expect(document.documentElement).not.toHaveAttribute('data-navigated')
  })

  it('marks the document on the first client navigation, and keeps the mark', () => {
    const { rerender } = render(<NavigationMark />)

    navigation.pathname = '/events/navratri-night-one-edison'
    rerender(<NavigationMark />)
    expect(document.documentElement).toHaveAttribute('data-navigated', '')

    navigation.pathname = '/events'
    rerender(<NavigationMark />)
    expect(document.documentElement).toHaveAttribute('data-navigated', '')
  })

  it('draws nothing', () => {
    const { container } = render(<NavigationMark />)

    expect(container).toBeEmptyDOMElement()
  })

  it('marks once, leaving an existing mark as it is', () => {
    markNavigated(document.documentElement)
    markNavigated(document.documentElement)

    expect(document.documentElement.dataset.navigated).toBe('')
  })

  it('is what the stylesheet gates plate registration on, every rule of it', () => {
    const css = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//gu, '')
    const rules = [...css.matchAll(/^\s*([^{}\n]*\[data-registration\][^{}\n]*)\{/gmu)].map(
      ([, selector]) => selector.trim(),
    )

    expect(rules).toEqual([
      ':root:not([data-navigated]) [data-registration] .poster-impression',
      ":root:not([data-navigated]) [data-registration] [data-impression='magenta']",
      ":root:not([data-navigated]) [data-registration] [data-impression='gold']",
      ":root:not([data-navigated]) [data-registration] [data-plate='ghost']",
    ])
  })
})
