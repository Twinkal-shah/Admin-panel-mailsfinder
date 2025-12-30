import { useEffect } from 'react'
import { useDataStore } from '../store/data'
import { Card, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { AuditRow } from '../types/types'

export default function AuditLogs() {
  const { audits, initDemoData, users } = useDataStore()

  useEffect(() => {
    if (users.length === 0) initDemoData()
  }, [])

  const columns = [
    { title: 'adminId', dataIndex: 'adminId' },
    { title: 'action', dataIndex: 'action' },
    { title: 'targetId', dataIndex: 'targetId' },
    { title: 'timestamp', dataIndex: 'timestamp', render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'reason', dataIndex: 'reason' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Audit & Basic Logs</Typography.Title>
      <Card>
        <Table<AuditRow> rowKey="id" dataSource={audits} columns={columns} />
      </Card>
    </div>
  )
}

