import { useEffect, useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Card, Form, Input, List, Modal, Typography, message } from 'antd'
import ReactMarkdown from 'react-markdown'
import dayjs from 'dayjs'
import { ContentItem } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { mapContent } from '../utils/mappers'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')

export default function CMSLite() {
  const { contents, setAll } = useDataStore()
  const { admin, token } = useAuthStore()
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  function authHeader(): string {
    const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
    return bearer ? `Bearer ${bearer}` : ''
  }

  async function reloadContents(signal?: AbortSignal) {
    const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/getAllContent`, {
      headers: { Authorization: authHeader() },
      signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    const source = Array.isArray(body) ? body : Array.isArray(body?.contents) ? body.contents : []
    setAll({ contents: source.map(mapContent) })
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setBackendError(null)
    reloadContents(controller.signal)
      .catch(() => {
        if (!cancelled) setBackendError('Failed to load content')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [token])

  function startCreate() {
    setEditing({
      title: '',
      slug: '',
      summary: '',
      body: '',
      attachments: []
    })
  }

  async function onSave(values: any) {
    const payload = {
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      body: values.body,
      attachments: values.attachments?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
    }
    setSaving(true)
    setBackendError(null)
    try {
      const url = editing?.id
        ? `${API_BASE_URL}/api/admin/contentManagement/updatedContent/${editing.id}`
        : `${API_BASE_URL}/api/admin/contentManagement/createContent`
      const method = editing?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader()
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadContents()
      message.success(editing?.id ? 'Content updated' : 'Content created')
      setEditing(null)
    } catch (e: any) {
      setBackendError(e?.message || 'Save failed')
      message.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(item: ContentItem) {
    if (!hasScope(admin.role, 'content.publish')) return
    Modal.confirm({
      title: 'Delete content',
      content: `Delete "${item.title}"? This cannot be undone.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeletingId(item.id)
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/deleteContent/${item.id}`, {
            method: 'DELETE',
            headers: { Authorization: authHeader() }
          })
          if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
          await reloadContents()
          message.success('Content deleted')
          if (editing?.id === item.id) setEditing(null)
        } catch (e: any) {
          message.error(e?.message || 'Delete failed')
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Content Management</Typography.Title>
        <Button type="primary" onClick={startCreate}>Create</Button>
      </div>

      {backendError && (
        <Typography.Text type="danger">{backendError}</Typography.Text>
      )}

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
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
          </Form.Item>
        </Form>

        {editing?.body && (
          <Card style={{ marginTop: 12 }} title="Preview (Markdown)">
            <ReactMarkdown>{editing.body}</ReactMarkdown>
          </Card>
        )}

        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Publish toggle is disabled — backend Content schema has no
          `is_published` field yet (see docs/BACKEND_TODO.md).
        </Typography.Paragraph>
      </Card>

      <Card title="Content List" loading={loading && contents.length === 0}>
        <List
          dataSource={contents}
          pagination={{ pageSize: 25 }}
          renderItem={(c) => (
            <List.Item
              actions={[
                <Button key="edit" onClick={() => setEditing(c)}>Edit</Button>,
                <Button
                  key="delete"
                  danger
                  loading={deletingId === c.id}
                  disabled={!hasScope(admin.role, 'content.publish')}
                  onClick={() => onDelete(c)}
                >
                  Delete
                </Button>
              ]}
            >
              <List.Item.Meta
                title={c.title}
                description={`slug: ${c.slug} • updated: ${dayjs(c.updatedAt).format('YYYY-MM-DD')}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
