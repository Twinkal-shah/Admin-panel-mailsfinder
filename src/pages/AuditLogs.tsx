import { Card, Result, Typography } from 'antd'

export default function AuditLogs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Audit & Basic Logs</Typography.Title>
      <Card>
        <Result
          status="info"
          title="Audit log API not yet wired on backend"
          subTitle="See docs/BACKEND_TODO.md — needs GET /api/admin/userManagement/audits."
        />
      </Card>
    </div>
  )
}
