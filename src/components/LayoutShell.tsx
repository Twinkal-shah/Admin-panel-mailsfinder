import { Layout, Menu, Typography, Dropdown, Button, Drawer, Grid, Tooltip, theme } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  UserOutlined,
  AuditOutlined,
  ApiOutlined,
  FileTextOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../store/auth'
import { useEffect, useMemo, useState } from 'react'

const { Header, Sider, Content } = Layout

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ key: '/', icon: <DashboardOutlined />, label: 'Dashboard' }]
  },
  {
    label: 'Management',
    items: [
      { key: '/users', icon: <UserOutlined />, label: 'Users' },
      { key: '/content', icon: <FileTextOutlined />, label: 'Content' }
    ]
  },
  {
    label: 'System',
    items: [
      { key: '/apikeys', icon: <ApiOutlined />, label: 'API Keys' },
      { key: '/audit', icon: <AuditOutlined />, label: 'Audit' }
    ]
  }
]

/** Page context for the header, keyed by the same route keys the menu uses. */
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

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="mf-brand__mark bg-brand-gradient" style={{ width: size, height: size }}>
      MF
    </span>
  )
}

export default function LayoutShell({
  isDark,
  onToggleTheme
}: {
  isDark: boolean
  onToggleTheme: (v: boolean) => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mf_sider_collapsed') === '1'
    } catch {
      return false
    }
  })
  const { token: antdToken } = theme.useToken()

  useEffect(() => {
    try {
      localStorage.setItem('mf_sider_collapsed', collapsed ? '1' : '0')
    } catch {}
  }, [collapsed])

  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1]
  const pageTitle = PAGE_TITLES[selectedKey] ?? 'Admin'

  // Grouped menu items. `type: 'group'` keeps every existing route key and
  // click handler intact — this is purely visual grouping.
  const menuItems: MenuProps['items'] = useMemo(() => {
    if (collapsed && !isMobile) {
      return NAV_GROUPS.flatMap(g => g.items)
    }
    return NAV_GROUPS.map(group => ({
      type: 'group' as const,
      key: `group-${group.label}`,
      label: <span className="mf-nav__group-label">{group.label}</span>,
      children: group.items
    }))
  }, [collapsed, isMobile])

  const roleLabel = ROLE_LABEL[admin.role] ?? admin.role

  const accountMenu: MenuProps = {
    items: [
      {
        key: 'identity',
        label: (
          <div className="mf-account__identity">
            <Typography.Text strong className="mf-account__email">
              {admin.email || 'Admin'}
            </Typography.Text>
            <Typography.Text type="secondary" className="mf-account__role">
              {roleLabel}
            </Typography.Text>
          </div>
        ),
        disabled: true
      },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true, onClick: logout }
    ]
  }

  const navMenu = (onNavigate?: () => void) => (
    <Menu
      className="mf-nav"
      theme={isDark ? 'dark' : 'light'}
      mode="inline"
      items={menuItems}
      selectedKeys={[selectedKey]}
      inlineIndent={14}
      onClick={({ key }) => {
        onNavigate?.()
        navigate(key)
      }}
    />
  )

  const initials = (admin.email || 'A').slice(0, 1).toUpperCase()

  return (
    <Layout className="mf-shell" style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          className="mf-sider"
          width={248}
          collapsedWidth={76}
          collapsed={collapsed}
          theme={isDark ? 'dark' : 'light'}
        >
          <div className="mf-sider__inner">
            <div className={`mf-brand${collapsed ? ' mf-brand--collapsed' : ''}`}>
              <BrandMark />
              {!collapsed && (
                <div className="mf-brand__text">
                  <span className="mf-brand__name">MailsFinder</span>
                  <span className="mf-brand__sub">Admin Panel</span>
                </div>
              )}
            </div>

            <nav className="mf-sider__nav">{navMenu()}</nav>

            <div className="mf-sider__foot">
              {!collapsed && (
                <div className="mf-role-chip">
                  <SafetyCertificateOutlined />
                  <span>{roleLabel}</span>
                </div>
              )}
              <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
                <Button
                  type="text"
                  className="mf-collapse-btn"
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(c => !c)}
                />
              </Tooltip>
            </div>
          </div>
        </Sider>
      )}

      <Layout className="mf-main">
        <Header className="mf-header">
          <div className="mf-header__left">
            {isMobile && (
              <Button
                type="text"
                aria-label="Open navigation"
                onClick={() => setDrawerOpen(true)}
                icon={<MenuOutlined />}
              />
            )}
            <div className="mf-header__context">
              <span className="mf-header__crumb">Admin</span>
              <span className="mf-header__sep">/</span>
              <span className="mf-header__page">{pageTitle}</span>
            </div>
          </div>

          <div className="mf-header__right">
            <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Button
                type="text"
                className="mf-theme-btn"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={isDark}
                icon={isDark ? <MoonOutlined /> : <SunOutlined />}
                onClick={() => onToggleTheme(!isDark)}
              />
            </Tooltip>
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button type="button" className="mf-account" aria-label="Account menu">
                <span className="mf-account__avatar" style={{ background: antdToken.colorPrimary }}>
                  {initials}
                </span>
                <span className="mf-account__meta">
                  <span className="mf-account__line1">{admin.email || 'Admin'}</span>
                  <span className="mf-account__line2">{roleLabel}</span>
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content className="mf-content">
          <div className="mf-content__inner page-transition" key={selectedKey}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      {isMobile && (
        <Drawer
          className="mf-drawer"
          title={
            <div className="mf-brand mf-brand--drawer">
              <BrandMark size={28} />
              <div className="mf-brand__text">
                <span className="mf-brand__name">MailsFinder</span>
                <span className="mf-brand__sub">Admin Panel</span>
              </div>
            </div>
          }
          placement="left"
          width={272}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          styles={{ body: { padding: '8px 0' } }}
        >
          {navMenu(() => setDrawerOpen(false))}
          <div className="mf-drawer__foot">
            <div className="mf-role-chip">
              <SafetyCertificateOutlined />
              <span>{roleLabel}</span>
            </div>
          </div>
        </Drawer>
      )}
    </Layout>
  )
}
