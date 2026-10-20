'use client'

/**
 * Where a buyer is in checkout: a gold route line with five stops (the event,
 * the tickets or seats, the details, paying, done) that draws itself from one
 * stop to the next as the basket moves on.
 *
 * ## Why a provider
 *
 * The line sits in the page's purple band, which the server draws; the step
 * lives in the basket, which is a client component further down. The page
 * wraps both in {@link CheckoutStepProvider}; the basket reports its step
 * with {@link useReportCheckoutStep}; the line reads it. Outside a provider
 * (a basket rendered alone in a test) reporting does nothing.
 *
 * ## What it says, and to whom
 *
 * It is a list of the stops in order, labelled "Checkout progress". The
 * current stop carries `aria-current="step"`, and a finished one says so in
 * words, so the line's colour and its check marks only repeat what is read.
 * The first stop is a link back to the event (a "back" navigation, which the
 * page transition slides the other way).
 *
 * ## How it moves
 *
 * One authored moment per page: the gold fill grows between stops on a
 * transform, 400ms, only without a reduced-motion setting (`commerce.css`).
 * The stops themselves change colour and nothing else. Nothing moves on
 * keyboard focus.
 *
 * @module components/checkout-route
 */

import './commerce.css'

import { Icon } from '@desi-event/ui/icons'
import Link from 'next/link'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/** The steps a basket can report, in order after the event itself. */
export const CHECKOUT_STEPS = Object.freeze(['tickets', 'details', 'pay', 'done'])

/** The basket's step, for the route line. */
const StepContext = createContext(null)

/**
 * Holds the basket's step for the route line.
 *
 * @param {object} props Component props.
 * @param {string} [props.initial] The step to start at.
 * @param {ReactNode} props.children The band and the basket.
 * @returns {JSX.Element} The provider.
 */
export function CheckoutStepProvider({ initial = 'tickets', children }) {
  const [step, setStep] = useState(CHECKOUT_STEPS.includes(initial) ? initial : 'tickets')
  const value = useMemo(() => ({ step, setStep }), [step])

  return <StepContext.Provider value={value}>{children}</StepContext.Provider>
}

/**
 * The step a basket's status means.
 *
 * Choosing, reserving, or starting again after a hold ran out or an order was
 * cancelled is the tickets step; held tickets waiting for names, codes and
 * the press of Pay are the details; a payment in flight or being checked is
 * paying; a booking is done.
 *
 * @param {string} status The basket's status.
 * @returns {'tickets'|'details'|'pay'|'done'} The step.
 */
export function checkoutStepFor(status) {
  switch (status) {
    case 'held':
    case 'pay-failed':
      return 'details'
    case 'paying':
    case 'unsettled':
      return 'pay'
    case 'paid':
      return 'done'
    default:
      return 'tickets'
  }
}

/**
 * Report the basket's step to the route line, when there is one.
 *
 * @param {string} step One of {@link CHECKOUT_STEPS}.
 * @returns {void}
 */
export function useReportCheckoutStep(step) {
  const context = useContext(StepContext)
  const setStep = context?.setStep

  useEffect(() => {
    if (setStep && CHECKOUT_STEPS.includes(step)) setStep(step)
  }, [setStep, step])
}

/**
 * @typedef {object} CheckoutRouteProps
 * @property {string} eventHref The event's page, the first stop.
 * @property {string} [choose] What the second stop is called ("Tickets" or "Seats").
 */

/**
 * The route line.
 *
 * @param {CheckoutRouteProps} props Component props.
 * @returns {JSX.Element} The line.
 */
export function CheckoutRoute({ eventHref, choose = 'Tickets' }) {
  const context = useContext(StepContext)
  const step = context?.step ?? 'tickets'
  const stops = [
    { key: 'event', label: 'Event' },
    { key: 'tickets', label: choose },
    { key: 'details', label: 'Details' },
    { key: 'pay', label: 'Pay' },
    { key: 'done', label: 'Done' },
  ]
  // The event is always behind the buyer: the basket's steps start at 1.
  const at = CHECKOUT_STEPS.indexOf(step) + 1
  const fill = at / (stops.length - 1)

  return (
    <nav aria-label="Checkout progress" data-step={step} className="mt-8">
      <ol className="relative grid grid-cols-5">
        {/* The track and its gold fill, from the first stop's centre to the
            last's. Decoration: the list says the same in words. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] top-3 h-0.5 -translate-y-1/2 bg-ink-inverse/25"
        >
          <span
            data-slot="route-fill"
            className="route-line-fill absolute inset-0 origin-left bg-accent-inverse"
            style={{ transform: `scaleX(${fill})` }}
          />
        </span>

        {stops.map((stop, index) => {
          const done = index < at
          const current = index === at
          const dot = (
            <span
              aria-hidden="true"
              className={`relative flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-(--duration-base) ease-out ${
                done
                  ? 'border-accent-inverse bg-accent-inverse text-surface-inverse'
                  : current
                    ? 'border-accent-inverse bg-surface-inverse'
                    : 'border-ink-inverse/40 bg-surface-inverse'
              }`}
            >
              {done ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : null}
              {current ? <span className="size-2 rounded-full bg-accent-inverse" /> : null}
            </span>
          )
          const label = (
            <span
              className={`mt-2 text-center text-caption ${
                done || current ? 'font-semibold text-ink-inverse' : 'text-ink-inverse-muted'
              }`}
            >
              {stop.label}
              {done ? <span className="sr-only">, done</span> : null}
            </span>
          )

          return (
            <li
              key={stop.key}
              aria-current={current ? 'step' : undefined}
              className="relative flex min-w-0 flex-col items-center"
            >
              {stop.key === 'event' ? (
                <Link
                  href={eventHref}
                  transitionTypes={['nav-back']}
                  className="flex min-h-11 flex-col items-center rounded-control px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {dot}
                  {label}
                </Link>
              ) : (
                <>
                  {dot}
                  {label}
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
