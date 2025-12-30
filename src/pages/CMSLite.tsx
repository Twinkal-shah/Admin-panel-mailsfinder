import { useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Card, Form, Input, List, Modal, Typography } from 'antd'
import ReactMarkdown from 'react-markdown'
import dayjs from 'dayjs'
import { ContentItem } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

export default function CMSLite() {
  const { contents, upsertContent, publishContent } = useDataStore()
  const { admin } = useAuthStore()
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null)
  const [reason, setReason] = useState<string>('')
  const [openModal, setOpenModal] = useState<boolean>(false)

  function startCreate() {
    setEditing({
      title: '',
      slug: '',
      summary: '',
      body: '',
      attachments: []
    })
  }

  function onSave(values: any) {
    const updated = upsertContent({
      id: editing?.id,
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      body: values.body,
      attachments: values.attachments?.split(',').map((s: string) => s.trim()).filter(Boolean)
    })
    setEditing(updated)
  }

  function confirmPublish() {
    if (!editing?.id) return
    publishContent(editing.id, admin.id, reason)
    setReason('')
    setOpenModal(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Content Management</Typography.Title>
        <Button type="primary" onClick={startCreate}>Create</Button>
      </div>

      <Card title="Create / Edit">
        <Form
          layout="vertical"
          onFinish={onSave}
          initialValues={{
            title: editing?.title,
            slug: editing?.slug,
            summary: editing?.summary,
            body: editing?.body,
            attachments: editing?.attachments?.join(', ')
          }}
        >
          <Form.Item label="title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="slug" name="slug" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="summary" name="summary"><Input /></Form.Item>
          <Form.Item label="body" name="body"><Input.TextArea rows={6} /></Form.Item>
          <Form.Item label="attachments" name="attachments"><Input placeholder="https://file1, https://file2" /></Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Save</Button>
          </Form.Item>
        </Form>

        {editing?.body && (
          <Card style={{ marginTop: 12 }} title="Preview (Markdown)">
            <ReactMarkdown>{editing.body}</ReactMarkdown>
          </Card>
        )}

        <div style={{ marginTop: 12 }}>
          <Button
            type="default"
            disabled={!hasScope(admin.role, 'content.publish') || !editing?.id}
            onClick={() => setOpenModal(true)}
          >
            Publish
          </Button>
        </div>
      </Card>

      <Card title="Content List">
        <List
          dataSource={contents}
          renderItem={(c) => (
            <List.Item actions={[<Button onClick={() => setEditing(c)}>Edit</Button>]}>
              <List.Item.Meta
                title={`${c.title} ${c.published ? '(published)' : ''}`}
                description={`slug: ${c.slug} • updated: ${dayjs(c.updatedAt).format('YYYY-MM-DD')}`}
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="Publish Content"
        open={openModal}
        onOk={confirmPublish}
        onCancel={() => setOpenModal(false)}
        okButtonProps={{ disabled: !reason }}
      >
        <Typography.Paragraph type="secondary">
          Publishing sets published=true and triggers a status flag so frontend can fetch new content.
          An audit row will be recorded.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Reason" required>
            <Input.TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

