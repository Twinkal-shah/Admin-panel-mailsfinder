import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Loader2, OctagonX, Plus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import dayjs from 'dayjs'
import { toast } from 'sonner'

import { useDataStore } from '../store/data'
import { ContentItem } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { mapContent } from '../utils/mappers'
import { API_BASE_URL } from '../utils/api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { Alert, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type StatusFilter = 'all' | 'published' | 'drafts'

interface EditState extends Partial<ContentItem> {
  // local-only flag for the form switch — stays in sync with `published`
  publishedFlag?: boolean
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  summary: z.string(),
  body: z.string(),
  attachments: z.string(),
  published: z.boolean()
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  title: '',
  slug: '',
  summary: '',
  body: '',
  attachments: '',
  published: false
}

export default function CMSLite() {
  const { contents, setAll } = useDataStore()
  const { admin, token } = useAuthStore()
  const [editing, setEditing] = useState<EditState | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null)

  const canPublish = hasScope(admin.role, 'content.publish')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const bodyValue = watch('body')
  const publishedValue = watch('published')

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
    const source = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.contents)
          ? body.contents
          : []
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
    reset({
      title: editing.title ?? '',
      slug: editing.slug ?? '',
      summary: editing.summary ?? '',
      body: editing.body ?? '',
      attachments: editing.attachments?.join(', ') ?? '',
      published: !!editing.publishedFlag
    })
  }, [editing, reset])

  function startCreate() {
    setEditing({ title: '', slug: '', summary: '', body: '', attachments: [], publishedFlag: false })
  }

  function startEdit(item: ContentItem) {
    setEditing({ ...item, publishedFlag: !!item.published })
  }

  function cancelEdit() {
    setEditing(null)
    reset(EMPTY)
  }

  /* Payload shape, URL/method selection and the published -> is_published
   * mapping are unchanged. */
  async function onSave(values: FormValues) {
    const payload = {
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      body: values.body,
      attachments:
        values.attachments
          ?.split(',')
          .map((s: string) => s.trim())
          .filter(Boolean) || [],
      is_published: !!values.published
    }
    setBackendError(null)
    try {
      const url = editing?.id
        ? `${API_BASE_URL}/api/admin/contentManagement/updatedContent/${editing.id}`
        : `${API_BASE_URL}/api/admin/contentManagement/createContent`
      const method = editing?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reloadContents()
      toast.success(editing?.id ? 'Content updated' : 'Content created')
      cancelEdit()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setBackendError(msg)
      toast.error(msg)
    }
  }

  async function confirmDelete() {
    const item = pendingDelete
    if (!item || !canPublish) return
    setPendingDelete(null)
    setDeletingId(item.id)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/contentManagement/deleteContent/${item.id}`,
        { method: 'DELETE', headers: { Authorization: authHeader() } }
      )
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      await reloadContents()
      toast.success('Content deleted')
      if (editing?.id === item.id) cancelEdit()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
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
      toast.success(next ? 'Published' : 'Unpublished')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  const filteredContents = useMemo(() => {
    if (statusFilter === 'published') return contents.filter((c) => c.published)
    if (statusFilter === 'drafts') return contents.filter((c) => !c.published)
    return contents
  }, [contents, statusFilter])

  const columns: DataTableColumn<ContentItem>[] = [
    { key: 'title', title: 'Title', dataIndex: 'title', className: 'font-medium' },
    {
      key: 'slug',
      title: 'Slug',
      hideOnMobile: true,
      render: (item) => <code className="font-mono text-xs text-muted-foreground">{item.slug}</code>
    },
    {
      key: 'published',
      title: 'Status',
      width: 120,
      render: (item) =>
        item.published ? (
          <Badge variant="secondary">Published</Badge>
        ) : (
          <Badge variant="outline">Draft</Badge>
        )
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      width: 140,
      hideOnMobile: true,
      render: (item) => (
        <span className="text-muted-foreground">
          {item.updatedAt ? dayjs(item.updatedAt).format('MMM D, YYYY') : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 260,
      fixed: 'right',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
            Edit
          </Button>
          <Button
            variant={item.published ? 'outline' : 'default'}
            size="sm"
            disabled={!canPublish || togglingId === item.id}
            onClick={() => togglePublish(item)}
          >
            {togglingId === item.id && <Loader2 className="animate-spin" />}
            {item.published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canPublish || deletingId === item.id}
            onClick={() => setPendingDelete(item)}
          >
            {deletingId === item.id && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Content Management"
        subtitle={
          contents.length > 0
            ? `${contents.length.toLocaleString()} items · ${contents.filter((c) => c.published).length} published`
            : 'Create and publish marketing content'
        }
        actions={
          <Button onClick={startCreate}>
            <Plus />
            Create
          </Button>
        }
      />

      {backendError && (
        <Alert variant="destructive">
          <OctagonX />
          <AlertTitle>{backendError}</AlertTitle>
        </Alert>
      )}

      <SectionCard
        title={editing?.id ? 'Edit content' : 'Create content'}
        description={
          editing?.id
            ? `Editing “${editing.title}”`
            : 'Fill in the fields and save to add a new item.'
        }
      >
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cms-title">Title</Label>
              <Input id="cms-title" aria-invalid={!!errors.title} {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cms-slug">Slug</Label>
              <Input id="cms-slug" aria-invalid={!!errors.slug} {...register('slug')} />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cms-summary">Summary</Label>
            <Input id="cms-summary" {...register('summary')} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cms-body">Body</Label>
            <Textarea id="cms-body" rows={8} className="font-mono text-xs" {...register('body')} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cms-attachments">Attachments</Label>
            <Input
              id="cms-attachments"
              placeholder="https://file1, https://file2"
              {...register('attachments')}
            />
            <p className="text-xs text-muted-foreground">Comma-separated URLs.</p>
          </div>

          <div className="flex items-center gap-2.5">
            <Switch
              id="cms-published"
              checked={publishedValue}
              disabled={!canPublish}
              onCheckedChange={(v) => setValue('published', v, { shouldDirty: true })}
            />
            <Label htmlFor="cms-published">Published</Label>
            {!canPublish && (
              <span className="text-xs text-muted-foreground">
                Your role cannot change publish state.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {bodyValue && (
          <Card size="sm" className="mt-4">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="prose-sm max-w-none text-sm [&_a]:text-primary [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-0.5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown>{bodyValue}</ReactMarkdown>
            </CardContent>
          </Card>
        )}
      </SectionCard>

      <SectionCard
        title="Content list"
        description="Everything currently stored, drafts included."
        extra={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger size="sm" className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="drafts">Drafts</SelectItem>
            </SelectContent>
          </Select>
        }
        noPadding
      >
        <DataTable<ContentItem>
          caption="Content items"
          rowKey="id"
          rows={filteredContents}
          columns={columns}
          loading={loading && contents.length === 0}
          size="sm"
          empty={
            <EmptyState
              compact
              icon={<FileText />}
              title={statusFilter === 'all' ? 'No content yet' : `No ${statusFilter} content`}
              hint="Use the form above to create your first item."
            />
          }
        />
      </SectionCard>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete content</AlertDialogTitle>
            <AlertDialogDescription>
              Delete “{pendingDelete?.title}”? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
