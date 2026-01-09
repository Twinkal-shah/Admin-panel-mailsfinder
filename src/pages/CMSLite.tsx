import { useEffect, useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Card, Form, Input, List, Modal, Typography } from 'antd'
import ReactMarkdown from 'react-markdown'
import dayjs from 'dayjs'
import { ContentItem } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

export default function CMSLite() {
  const { contents, upsertContent, publishContent, setAll } = useDataStore()
  const { admin, token } = useAuthStore()
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null)
  const [reason, setReason] = useState<string>('')
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [backendError, setBackendError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setBackendError(null)
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/getAllContent`, {
          headers: { Authorization: bearer ? `Bearer ${bearer}` : '' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        if (cancelled) return
        const source = Array.isArray(body) ? body : Array.isArray(body?.contents) ? body.contents : []
        const mapped = source.map((c: any) => ({
          id: String(c._id ?? c.id),
          title: c.title ?? '',
          slug: c.slug ?? '',
          summary: c.summary ?? undefined,
          body: c.body ?? '',
          attachments: Array.isArray(c.attachments) ? c.attachments : [],
          published: !!(c.published ?? c.is_published),
          updatedAt:
            (c.updatedAt && new Date(c.updatedAt).toISOString()) ||
            (c.createdAt && new Date(c.createdAt).toISOString()) ||
            new Date().toISOString()
        })) as ContentItem[]
        setAll({ contents: mapped })
      } catch (e) {
        setBackendError('Failed to load content')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, setAll])

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
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
    setSaving(true)
    try {
      if (editing?.id) {
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/updatedContent/${editing.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearer ? `Bearer ${bearer}` : ''
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else {
        const bearer2 = token || localStorage.getItem('ADMIN_TOKEN') || ''
        const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/createContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearer2 ? `Bearer ${bearer2}` : ''
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      const bearer3 = token || localStorage.getItem('ADMIN_TOKEN') || ''
      const reload = await fetch(`${API_BASE_URL}/api/admin/contentManagement/getAllContent`, {
        headers: { Authorization: bearer3 ? `Bearer ${bearer3}` : '' }
      })
      if (reload.ok) {
        const body = await reload.json()
        const source = Array.isArray(body) ? body : Array.isArray(body?.contents) ? body.contents : []
        const mapped = source.map((c: any) => ({
          id: String(c._id ?? c.id),
          title: c.title ?? '',
          slug: c.slug ?? '',
          summary: c.summary ?? undefined,
          body: c.body ?? '',
          attachments: Array.isArray(c.attachments) ? c.attachments : [],
          published: !!(c.published ?? c.is_published),
          updatedAt:
            (c.updatedAt && new Date(c.updatedAt).toISOString()) ||
            (c.createdAt && new Date(c.createdAt).toISOString()) ||
            new Date().toISOString()
        })) as ContentItem[]
        setAll({ contents: mapped })
      }
    } catch (e) {
      setBackendError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmPublish() {
    if (!editing?.id) return
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
    try {
      const bearer4 = token || localStorage.getItem('ADMIN_TOKEN') || ''
      const res = await fetch(`${API_BASE_URL}/api/admin/contentManagement/updatedContent/${editing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer4 ? `Bearer ${bearer4}` : ''
        },
        body: JSON.stringify({ published: true, reason })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bearer5 = token || localStorage.getItem('ADMIN_TOKEN') || ''
      const reload = await fetch(`${API_BASE_URL}/api/admin/contentManagement/getAllContent`, {
        headers: { Authorization: bearer5 ? `Bearer ${bearer5}` : '' }
      })
      if (reload.ok) {
        const body = await reload.json()
        const source = Array.isArray(body) ? body : Array.isArray(body?.contents) ? body.contents : []
        const mapped = source.map((c: any) => ({
          id: String(c._id ?? c.id),
          title: c.title ?? '',
          slug: c.slug ?? '',
          summary: c.summary ?? undefined,
          body: c.body ?? '',
          attachments: Array.isArray(c.attachments) ? c.attachments : [],
          published: !!(c.published ?? c.is_published),
          updatedAt:
            (c.updatedAt && new Date(c.updatedAt).toISOString()) ||
            (c.createdAt && new Date(c.createdAt).toISOString()) ||
            new Date().toISOString()
        })) as ContentItem[]
        setAll({ contents: mapped })
      }
    } catch (e) {
      setBackendError('Publish failed')
    } finally {
      setReason('')
      setOpenModal(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
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
