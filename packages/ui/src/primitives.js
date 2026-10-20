/**
 * `@desi-event/ui/primitives`: the light primitives, for a client barrel.
 *
 * Everything the entry point (`./index.js`) exports except the floating
 * layers that bring a library with them: `Popover`, `Menu` and `Tooltip`
 * (Base UI and its positioning) and `Toaster`/`toast` (Sonner). A
 * `'use client'` barrel that re-exported the whole entry point put all of
 * that in the one chunk every route loads, the public pages' included, for
 * the sake of one popover in the header. Those four have subpaths of their
 * own (`./popover`, `./menu`, `./tooltip`, `./toast`), imported only where
 * they are drawn.
 *
 * @module @desi-event/ui/primitives
 */

export { cn } from './cn.js'

export { Button, ButtonLink } from './Button.jsx'
export { buttonClasses, textLinkClasses } from './buttonClasses.js'
export { TextLink } from './TextLink.jsx'
export { Badge } from './Badge.jsx'
export { Card, CardHeader, CardBody, CardFooter } from './Card.jsx'
export { Input } from './Input.jsx'
export { Textarea } from './Textarea.jsx'
export { Select } from './Select.jsx'
export { Label } from './Label.jsx'
export { FormField } from './FormField.jsx'
export { Alert } from './Alert.jsx'
export { StatusIcon } from './StatusIcon.jsx'
export { Spinner } from './Spinner.jsx'
export { Skeleton } from './Skeleton.jsx'
export { EmptyState } from './EmptyState.jsx'
export { VisuallyHidden } from './VisuallyHidden.jsx'
export { Modal } from './Modal.jsx'
export { Tabs } from './Tabs.jsx'
export { Sheet } from './Sheet.jsx'
export { Stat } from './Stat.jsx'
export { Kbd } from './Kbd.jsx'
export { SegmentedControl } from './SegmentedControl.jsx'
export { Icon } from './icons/Icon.jsx'
