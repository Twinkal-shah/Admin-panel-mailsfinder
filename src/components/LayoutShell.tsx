import { Layout, Menu, Typography, Dropdown, Button, Drawer, Grid, Switch } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  UserOutlined,
  AuditOutlined,
  ApiOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { MenuOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { useState } from 'react'

const { Header, Sider, Content } = Layout

export default function LayoutShell({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: (v: boolean) => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selectedKey =
    location.pathname === '/'
      ? '/'
      : '/' + location.pathname.split('/')[1]

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/users', icon: <UserOutlined />, label: 'Users' },
    { key: '/content', icon: <FileTextOutlined />, label: 'Content' },
    { key: '/apikeys', icon: <ApiOutlined />, label: 'API Keys' },
    { key: '/audit', icon: <AuditOutlined />, label: 'Audit' }
  ]

  const menu = (
    <Menu
      items={[
        { key: 'role', label: `Role: ${admin.role}` },
        { type: 'divider' },
        { key: 'logout', label: 'Logout', onClick: logout }
      ]}
    />
  )

  return (
    <Layout style={{ minHeight: '100vh', background: isDark ? '#050505' : '#ffffff' }}>
      {!isMobile && (
        <Sider width={220} theme={isDark ? 'dark' : 'light'}>
          <div style={{ padding: 16 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              MailsFinder
            </Typography.Title>
            <Typography.Text type="secondary">Admin</Typography.Text>
          </div>
          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            items={items}
            selectedKeys={[selectedKey]}
            onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: isDark ? '1px solid #262626' : undefined }}
          />
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: isMobile ? 12 : 20,
            background: isDark ? '#050505' : '#ffffff',
            borderBottom: isDark ? '1px solid #262626' : '1px solid #e5e7eb'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Button type="text" aria-label="Open navigation" onClick={() => setDrawerOpen(true)} icon={<MenuOutlined />} />
            )}
            <Typography.Text>Welcome, {admin.name}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Switch
              checked={isDark}
              onChange={(v) => onToggleTheme(v)}
              checkedChildren="Dark"
              unCheckedChildren="Light"
            />
            <Dropdown overlay={menu} trigger={['click']}>
              <Button type="default">{admin.email}</Button>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24 }}>
          <Outlet />
        </Content>
      </Layout>
      {isMobile && (
        <Drawer
          title="MailsFinder Admin"
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bodyStyle={{ padding: 0, background: isDark ? '#050505' : '#ffffff' }}
        >
          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            items={items}
            selectedKeys={[selectedKey]}
            onClick={({ key }) => {
              setDrawerOpen(false)
              navigate(key)
            }}
            style={{}}
          />
        </Drawer>
      )}
    </Layout>
  )
}
