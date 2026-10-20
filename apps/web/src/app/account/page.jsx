/**
 * The account overview: who you are signed in as, and where to go from here.
 *
 * Where signing in lands by default. It used to land on the organiser's event
 * list whoever you were, which for somebody who had only bought a ticket was
 * a workspace they had no use for.
 *
 * Everything here comes from `GET /v1/auth/me` — the one read every page
 * already makes — so this page makes no request of its own and cannot show
 * anything the session did not already carry.
 *
 * @module app/account/page
 */

import { Icon } from '@desi-event/ui/icons'
import Link from 'next/link'

import { PageHeader, PANEL, Section } from '../../components/workspace-kit.jsx'
import { workspaceHome } from '../../lib/navigation.js'
import { readSession } from '../../lib/session.js'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Your account', robots: { index: false, follow: false } }

/**
 * One place to go from here: a row of the account's index, the whole row a
 * single link. Rows, not a grid of cards: the places are a list to read down,
 * and the rail beside the page names the same ones for anybody who knows
 * where they are going.
 *
 * @param {object} props Component props.
 * @param {string} props.href Where it goes.
 * @param {string} props.title What it is called.
 * @param {string} props.children One line about what is there.
 * @returns {JSX.Element} The row.
 */
function Destination({ href, title, children }) {
  return (
    <li className="border-b border-line">
      <Link
        href={href}
        className="group flex min-h-11 items-start justify-between gap-4 rounded-sm py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="min-w-0">
          <span className="block font-display text-h3 font-bold text-ink underline-offset-4 decoration-2 decoration-accent group-hover:underline">
            {title}
          </span>
          <span className="mt-1 block max-w-prose text-sm text-ink-muted">{children}</span>
        </span>
        <Icon
          name="chevron-right"
          className="mt-1 size-5 shrink-0 text-accent-strong transition-transform duration-(--duration-fast) ease-out motion-safe:group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  )
}

/**
 * One fact about the account, as a term and its description.
 *
 * @param {object} props Component props.
 * @param {string} props.term What it is.
 * @param {ReactNode} props.children What it says.
 * @returns {JSX.Element} The pair.
 */
function Fact({ term, children }) {
  return (
    <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-ink-muted">{term}</dt>
      <dd className="mt-1 text-sm break-words text-ink sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  )
}

/**
 * The account overview page.
 *
 * @returns {Promise<JSX.Element>} The rendered page.
 */
export default async function AccountPage() {
  const session = await readSession()
  const user = session?.user ?? {}
  const workspace = workspaceHome(session)
  const secondFactor = session?.session ?? {}

  return (
    <div>
      <PageHeader
        title="Your account"
        description="Your tickets, and the account they belong to."
      />

      <Section id="account-facts" title="Signed in as" className="mt-10">
        <dl className={`mt-4 divide-y divide-line px-5 ${PANEL}`}>
          <Fact term="Name">{user.displayName}</Fact>
          <Fact term="Email address">
            {user.email}
            {user.emailVerified ? null : (
              <span className="mt-1 block text-ink-muted">
                Not confirmed. This site does not email confirmation links, and nothing you can do
                here depends on it.
              </span>
            )}
          </Fact>
          <Fact term="Two-step sign-in">
            {secondFactor.mfaEnrolled
              ? 'On: signing in asks for a code as well as your password.'
              : 'Off.'}
            {secondFactor.mfaRequired && !secondFactor.mfaEnrolled ? (
              <span className="mt-1 block text-status-warning">
                An organisation role you hold needs it, and until it is set up the workspace will
                refuse to work for this account.
              </span>
            ) : null}
          </Fact>
        </dl>
      </Section>

      <Section id="account-next" title="Where to go">
        <ul className="mt-2 grid border-t border-line lg:grid-cols-2 lg:gap-x-10">
          <Destination href="/tickets" title="My tickets">
            Your passes, what they admit to, and what you have handed on.
          </Destination>
          <Destination href="/account/orders" title="Orders">
            What you bought, what it cost, and the tickets each order gave you.
          </Destination>
          <Destination href="/account/transfers" title="Transfers">
            Tickets you are offering, have handed on, or were given, and where to accept one.
          </Destination>
          <Destination href="/account/security" title="Security">
            Your password, two-step sign-in, and where you are signed in.
          </Destination>
          <Destination href="/account/privacy" title="Privacy">
            What is kept about you, who sees it, and what you can change.
          </Destination>
          <Destination href="/account/invitations" title="Join an organisation’s team">
            Type the invitation code somebody on a team gave you, and join it in the role they
            chose.
          </Destination>
          <Destination href="/account/organizations/new" title="Accept an organiser invitation">
            Enter the organiser invitation code the team at The Desi Events sent you.
          </Destination>
          {workspace ? (
            <Destination href={workspace} title="Workspace">
              The events, venues, doors and money you look after for an organisation.
            </Destination>
          ) : null}
        </ul>
      </Section>
    </div>
  )
}
