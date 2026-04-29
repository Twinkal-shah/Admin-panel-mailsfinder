import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/data'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import ReactMarkdown from 'react-markdown'
import dayjs from 'dayjs'
import { ContentItem } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { mapContent } from '../utils/mappers'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')

type StatusFilter = 'all' | 'published' | 'drafts'

interface EditState extends Partial<ContentItem> {
  // local-only flag for the form Switch — stays in sync with `published`
  publishedFlag?: boolean
}

export default function CMSLite() {
  const { contents, setAll } = useDataStore()
  const { admin, token } = useAuthStore()
  const [editing, setEditing] = useState<EditState | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [form] = Form.useForm()

  const canPublish = hasScope(admin.role, 'content.publish')

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

  // Sync the form when entering edit mode or starting fresh.
  useEffect(() => {
    if (!editing) return
    form.setFieldsValue({
      title: editing.title ?? '',
      slug: editing.slug ?? '',
      summary: editing.summary ?? '',
      body: editing.body ?? '',
      attachments: editing.attachments?.join(', ') ?? '',
      published: !!editing.publishedFlag
    })
  }, [editing, form])

  function startCreate() {
    setEditing({
      title: '',
      slug: '',
      summary: '',
      body: '',
      attachments: [],
      publishedFlag: false
    })
  }

  function startEdit(item: ContentItem) {
    setEditing({ ...item, publishedFlag: !!item.published })
  }

  async function onSave(values: any) {
    const payload = {
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      body: values.body,
      attachments: values.attachments?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
      is_published: !!values.published
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
      form.resetFields()
    } catch (e: any) {
      setBackendError(e?.message || 'Save failed')
      message.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(item: ContentItem) {
    if (!canPublish) return
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
          if (editing?.id === item.id) {
            setEditing(null)
            form.resetFields()
          }
        } catch (e: any) {
          message.error(e?.message || 'Delete failed')
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  async function togglePublish(item: ContentItem) {
    if (!canPublish) return
    const next = !item.published
    setTogglingId(item.id)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/contentManagement/updatedContent/${item.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
          body: JSON.stringify({ is_published: next })
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadContents()
      message.success(next ? 'Published' : 'Unpublished')
    } catch (e: any) {
      message.error(e?.message || 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  const filteredContents = useMemo(() => {
    if (statusFilter === 'published') return contents.filter(c => c.published)
    if (statusFilter === 'drafts') return contents.filter(c => !c.published)
    return contents
  }, [contents, statusFilter])

  const columns: ColumnsType<ContentItem> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (s: string) => <Typography.Text code>{s}</Typography.Text>
    },
    {
      title: 'Status',
      dataIndex: 'published',
      key: 'published',
      width: 120,
      render: (p: boolean) => (p ? <Tag color="green">Published</Tag> : <Tag>Draft</Tag>)
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (d: string) => (d ? dayjs(d).format('MMM D, YYYY') : '-')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_, item) => (
        <Space>
          <Button size="small" onClick={() => startEdit(item)}>Edit</Button>
          <Button
            size="small"
            type={item.published ? 'default' : 'primary'}
            disabled={!canPublish}
            loading={togglingId === item.id}
            onClick={() => togglePublish(item)}
          >
            {item.published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button
            size="small"
            danger
            disabled={!canPublish}
            loading={deletingId === item.id}
            onClick={() => onDelete(item)}
          >
            Delete
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Content Management</Typography.Title>
        <Button type="primary" onClick={startCreate}>Create</Button>
      </div>

      {backendError && (
        <Typography.Text type="danger">{backendError}</Typography.Text>
      )}

      <Card title={editing?.id ? 'Edit content' : 'Create content'}>
        <Form
          layout="vertical"
          form={form}
          onFinish={onSave}
        >
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Slug" name="slug" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Summary" name="summary"><Input /></Form.Item>
          <Form.Item label="Body" name="body"><Input.TextArea rows={6} /></Form.Item>
          <Form.Item label="Attachments" name="attachments"><Input placeholder="https://file1, https://file2" /></Form.Item>
          <Form.Item label="Published" name="published" valuePropName="checked">
            <Switch disabled={!canPublish} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
              {editing && (
                <Button onClick={() => { setEditing(null); form.resetFields() }}>
                  Cancel
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>

        {editing?.body && (
          <Card style={{ marginTop: 12 }} title="Preview (Markdown)">
            <ReactMarkdown>{editing.body}</ReactMarkdown>
          </Card>
        )}
      </Card>

      <Card
        title="Content List"
        extra={
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'published', label: 'Published' },
              { value: 'drafts', label: 'Drafts' }
            ]}
          />
        }
        loading={loading && contents.length === 0}
      >
        <Table<ContentItem>
          rowKey="id"
          dataSource={filteredContents}
          columns={columns}
          pagination={{ pageSize: 25 }}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}
