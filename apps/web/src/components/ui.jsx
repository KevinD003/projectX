'use client'

/**
 * The application's client boundary for `@desi-event/ui`.
 *
 * The component library is framework-agnostic: it ships plain React and does
 * not declare `'use client'` anywhere, which is the right call for a package
 * that has to work outside Next.js too. But its entry point is a barrel, and
 * three of the components behind that barrel (`Modal`, `Tabs`, `FormField`)
 * use hooks — so importing *anything* from it into a Server Component drags
 * `useState` into the server graph and the build fails. The package's
 * `exports` map offers no subpath, so deep-importing a single file is not an
 * option either.
 *
 * Declaring the boundary here, once, is the fix: the primitives this app uses
 * are re-exported from a module that is explicitly a client module. Pages and
 * layouts stay Server Components and simply pass props and children across the
 * boundary, which is exactly what the boundary is for. The cost is that these
 * presentational leaves are hydrated on the client; the alternative is
 * reimplementing them, which would be worse.
 *
 * It re-exports the light primitives only (`@desi-event/ui/primitives`).
 * Every route loads this module, so whatever it names is in every route's
 * first chunk: when it named the whole library, Base UI (behind Popover, Menu
 * and Tooltip) and Sonner (behind a Toaster nothing called) shipped to the
 * home page for the sake of one header popover. Those layers are imported
 * from their own subpaths (`@desi-event/ui/popover`, `/menu`, `/tooltip`,
 * `/toast`) by the few components that draw them, and the header's search
 * loads its popover only when first asked for (`header-search.jsx`).
 *
 * @module components/ui
 */

export {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  FormField,
  Icon,
  Input,
  Kbd,
  Label,
  Modal,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Spinner,
  Stat,
  StatusIcon,
  TextLink,
  Textarea,
  VisuallyHidden,
} from '@desi-event/ui/primitives'
