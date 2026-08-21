import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  ChevronsUpDown,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  ShieldCheck,
  Sun,
  Users
} from 'lucide-react'

import { useAuthStore } from '../store/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'

/**
 * The app shell: an icon-collapsible inset sidebar and a sticky page header,
 * rebuilt on the shadcn Sidebar primitive.
 *
 * The Antd `Drawer` that used to serve viewports below `md` is gone — the
 * Sidebar renders itself into a Sheet on mobile, so there is one nav
 * definition instead of two that could drift apart.
 */

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }]
  },
  {
    label: 'Management',
    items: [
      { to: '/users', icon: Users, label: 'Users' },
      { to: '/content', icon: FileText, label: 'Content' }
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/apikeys', icon: KeyRound, label: 'API Keys' },
      { to: '/audit', icon: ScrollText, label: 'Audit' }
    ]
  }
] as const

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Users',
  '/content': 'Content',
  '/apikeys': 'API Keys',
  '/audit': 'Audit'
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super Admin',
  product_manager: 'Product Manager',
  support: 'Support'
}

function BrandMark() {
  return (
    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
      MF
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Moon /> : <Sun />}
    </Button>
  )
}

function AccountMenu() {
  const { admin, logout } = useAuthStore()
  const email = admin.email || 'Admin'
  const roleLabel = ROLE_LABEL[admin.role] ?? admin.role
  const initial = email.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      {/* Children belong on the trigger, NOT inside the `render` element.
          Base UI clones the render element and merges the trigger's own props
          (ref included) onto it; nesting children inside it instead breaks the
          ref merge and React warns that a function component was given a ref. */}
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
          />
        }
      >
        <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </div>
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{email}</span>
          <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
        </div>
        <ChevronsUpDown className="ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={4} className="min-w-56">
        {/* Reachable by keyboard, unlike the old `disabled: true` identity row
            which screen readers and tab navigation could not get to at all. */}
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{email}</span>
          <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function LayoutShell() {
  const location = useLocation()
  const { admin } = useAuthStore()

  // `/users/:id` must keep highlighting Users, so match on the first segment.
  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1]
  const pageTitle = PAGE_TITLES[selectedKey] ?? 'Admin'
  const roleLabel = ROLE_LABEL[admin.role] ?? admin.role

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/" />}>
                <BrandMark />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">MailsFinder</span>
                  <span className="truncate text-xs text-muted-foreground">Admin Panel</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="mf-scroll-thin">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = selectedKey === item.to
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} />}
                        isActive={isActive}
                        tooltip={item.label}
                        // Crimson rail + tint on the active row. The label stays
                        // on the neutral sidebar-accent-foreground token, which
                        // sidesteps the contrast problem crimson-on-crimson text
                        // would create in dark mode.
                        className={
                          isActive
                            ? 'relative bg-primary/10 text-sidebar-accent-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary hover:bg-primary/15'
                            : undefined
                        }
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                <span className="truncate">{roleLabel}</span>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <AccountMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* No title here on purpose. PageHeader inside each route owns the
            page title (plus its subtitle and actions), so repeating it in the
            top bar would show the same words twice and fight for the eye. */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="sr-only" aria-live="polite">
            {pageTitle}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* `min-w-0` is load-bearing: a flex child defaults to min-width:auto,
            so a wide table would force this pane wider than the viewport
            instead of scrolling inside its own container. */}
        <main
          id="main-content"
          key={selectedKey}
          className="mf-route-fade flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
