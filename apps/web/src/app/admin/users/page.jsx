/**
 * People and roles: finding an account, changing its platform role, and
 * putting it into an organisation directly.
 *
 * The page is a shell; the search and every change happen in client
 * components that talk to the API through the same-origin proxy. Nothing here
 * decides who may do what — the API checks again, with a recent second factor,
 * on every change.
 *
 * The area admits finance administrators as well, for refunding a booking fee
 * by hand. This page is the platform administrators' (`platform:admin`: ADMIN
 * and SUPER_ADMIN, ADR 0018), so it asks again and tells anybody else who
 * opens it, in words, that it is not theirs — rather than drawing a search
 * whose every answer would be a refusal.
 *
 * Changing a platform role is the super administrators' alone
 * (`platform:role_manage`). The page decides that here and hands the search a
 * boolean, so a platform administrator is shown each account's platform role
 * but no control to change it; the API refuses the change too.
 *
 * @module app/admin/users/page
 */

import Link from 'next/link'

import { PageHeader, SECONDARY_LINK } from '../../../components/workspace-kit.jsx'
import { sessionCan } from '../../../lib/capabilities.js'
import { readSession } from '../../../lib/session.js'
import { UserSearch } from './user-search.jsx'

/** What somebody without platform administration who opens this page is told. */
export const PLATFORM_ADMINISTRATORS_ONLY =
  'Finding accounts and putting people into organisations directly are held by platform administrators and super administrators. Your role does not include them, and nothing on this page can grant them.'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'People and roles', robots: { index: false, follow: false } }

/**
 * The screen.
 *
 * @returns {Promise<JSX.Element>} The rendered page, or the refusal.
 */
export default async function PeopleAndRolesPage() {
  const session = await readSession()

  if (!sessionCan(session, 'platform:admin')) {
    return (
      <div>
        <PageHeader title="Not for you" description={PLATFORM_ADMINISTRATORS_ONLY} />
        <p className="mt-6">
          <Link href="/admin" className={SECONDARY_LINK}>
            Back to platform administration
          </Link>
        </p>
      </div>
    )
  }

  const mayChangePlatformRoles = sessionCan(session, 'platform:role_manage')

  return (
    <div>
      <PageHeader
        title="People and roles"
        description={`${
          mayChangePlatformRoles
            ? 'Find an account by its email address, name or id. You can change its platform role, or put it into an organisation with a role, owner included, for an organisation whose only owner has left.'
            : 'Find an account by its email address, name or id. You can put it into an organisation with a role, owner included, for an organisation whose only owner has left. Changing a platform role is for super administrators.'
        } Every change needs a reason and a recent confirmation of your second factor, and ends every session the account holds.`}
      />

      <UserSearch mayChangePlatformRoles={mayChangePlatformRoles} />
    </div>
  )
}
