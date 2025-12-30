import { Layout, Menu, Typography, Dropdown, Button } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  UserOutlined,
  AuditOutlined,
  ApiOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../store/auth'

const { Header, Sider, Content } = Layout

export default function LayoutShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
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
    <Layout style={{ minHeight: '100vh', background: '#050505' }}>
      <Sider width={220} theme="dark" style={{ background: '#050505' }}>
        <div style={{ padding: 16 }}>
          <Typography.Title level={4} style={{ margin: 0, color: '#f5f5f5' }}>
            MailsFinder
          </Typography.Title>
          <Typography.Text type="secondary" style={{ color: '#a3a3a3' }}>Admin</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#050505', borderInlineEnd: '1px solid #262626' }}
        />
      </Sider>
      <Layout style={{ background: '#050505' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 20,
            background: '#050505',
            borderBottom: '1px solid #262626'
          }}
        >
          <Typography.Text style={{ color: '#f5f5f5' }}>Welcome, {admin.name}</Typography.Text>
          <Dropdown overlay={menu} trigger={['click']}>
            <Button type="default">{admin.email}</Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, background: '#050505' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
