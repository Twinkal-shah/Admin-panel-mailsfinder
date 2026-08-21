import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, OctagonX } from 'lucide-react'

import { useAuthStore } from '../store/auth'
import type { Role } from '../types/types'
import { API_BASE_URL } from '../utils/api'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  })

  /* Request, token extraction and store call are unchanged from the Antd
   * version. react-hook-form replaced how the field values are collected and
   * validated; it did not touch what gets sent or what is done with the reply. */
  async function onFinish(values: FormValues) {
    setError(null)
    try {
      const email = values.email.trim().toLowerCase()
      const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password: values.password })
      })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const errBody = await res.json()
          msg = errBody?.message || msg
        } catch {}
        throw new Error(msg)
      }
      const body = await res.json()
      const token: string | undefined =
        body.ADMIN_TOKEN ||
        body.admin_token ||
        body.token ||
        body.jwt ||
        body.session?.token ||
        body.data?.accessToken
      if (!token) throw new Error('Missing ADMIN_TOKEN in response')
      const refreshToken: string | undefined =
        body.data?.refreshToken || body.refreshToken || body.refresh_token
      const adminData = body.data?.admin
      const admin = {
        id: String(adminData?._id ?? adminData?.id ?? 'admin-1'),
        name: adminData?.name ?? adminData?.full_name ?? 'Admin',
        email: adminData?.email ?? email,
        role: (adminData?.role ?? 'superadmin') as Role
      }
      login(admin, token, refreshToken)
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2.5 self-center">
          <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            MF
          </div>
          <div className="grid leading-tight">
            <span className="text-sm font-semibold">MailsFinder</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <OctagonX />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onFinish)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="h-9"
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="h-9 pr-9"
                {...register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1 right-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
