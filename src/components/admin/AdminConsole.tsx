import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Crown,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { getAdminOverview, setUserRole } from '../../lib/adminClient'
import { useJobmatchStore } from '../../store/useJobmatchStore'
import { CountUp } from '../landing/CountUp'
import type { AdminOverview, AdminUserStat, UserRole } from '../../types'

const ROLE_BADGE: Record<UserRole, string> = {
  superadmin: 'border-violet/40 bg-violet/15 text-violet',
  admin: 'border-primary/40 bg-primary/15 text-primary',
  job_seeker: 'border-line bg-bg/60 text-muted',
}

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  job_seeker: 'Member',
}

export function AdminConsole() {
  const navigate = useNavigate()
  const viewAsUser = useJobmatchStore((state) => state.viewAsUser)
  const myRole = useJobmatchStore((state) => state.profile.role)
  const myId = useJobmatchStore((state) => state.profile.id)
  const isSuperadmin = myRole === 'superadmin'

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      setOverview(await getAdminOverview())
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin data.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onViewAs = async (user: AdminUserStat) => {
    setBusyId(user.id)
    setError('')
    try {
      await viewAsUser(user.id)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that workspace.')
    } finally {
      setBusyId('')
    }
  }

  const onRoleChange = async (user: AdminUserStat, role: UserRole) => {
    if (role === user.role) return
    setBusyId(user.id)
    setError('')
    try {
      await setUserRole(user.id, role)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role.')
    } finally {
      setBusyId('')
    }
  }

  const kpis = [
    { label: 'Total users', value: overview?.totalUsers ?? 0, icon: Users, accent: 'text-primary', ring: 'bg-primary/15' },
    { label: 'Applications', value: overview?.totalApplications ?? 0, icon: FileText, accent: 'text-success', ring: 'bg-success/15' },
    { label: 'Live searches', value: overview?.totalSearches ?? 0, icon: Search, accent: 'text-cyan', ring: 'bg-cyan/15' },
    { label: 'Active users', value: overview?.activeUsers ?? 0, icon: Activity, accent: 'text-violet', ring: 'bg-violet/15' },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="panel p-5">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${kpi.ring} ${kpi.accent}`}>
                <Icon size={20} />
              </div>
              <p className="text-3xl font-extrabold tracking-tight text-ink">
                <CountUp to={kpi.value} />
              </p>
              <p className="mt-1 text-sm text-muted">{kpi.label}</p>
            </div>
          )
        })}
      </div>

      {/* Users table */}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">People</h2>
              <p className="text-sm text-muted">
                {isSuperadmin ? 'Manage roles and open any workspace read-only.' : 'View activity and open any workspace read-only.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} className="secondary-button h-9 text-xs" disabled={status === 'loading'}>
            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error ? (
          <p className="m-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        ) : null}

        {status === 'loading' && !overview ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-line/40" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 text-right font-semibold">Applied</th>
                  <th className="px-3 py-3 text-right font-semibold">Searches</th>
                  <th className="px-3 py-3 text-right font-semibold">CVs</th>
                  <th className="px-3 py-3 font-semibold">Last active</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.users ?? []).map((user) => (
                  <tr key={user.id} className="border-b border-line/60 transition-colors hover:bg-bg/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold uppercase text-primary">
                          {(user.name || user.email).slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{user.name}</p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[user.role]}`}>
                        {user.role === 'superadmin' ? <Crown size={12} /> : user.role === 'admin' ? <ShieldCheck size={12} /> : null}
                        {ROLE_LABEL[user.role]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-ink">{user.appliedCount}</td>
                    <td className="px-3 py-3 text-right font-mono text-ink">{user.searchCount}</td>
                    <td className="px-3 py-3 text-right font-mono text-ink">{user.cvCount}</td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {user.lastActiveAt ? `${formatDistanceToNowStrict(new Date(user.lastActiveAt))} ago` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {isSuperadmin ? (
                          <select
                            className="control h-8 rounded-lg px-2 text-xs"
                            value={user.role}
                            disabled={busyId === user.id || user.id === myId}
                            onChange={(event) => void onRoleChange(user, event.target.value as UserRole)}
                            aria-label={`Set role for ${user.email}`}
                          >
                            <option value="job_seeker">Member</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void onViewAs(user)}
                          disabled={busyId === user.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-xs font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          <Eye size={13} /> View as
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {overview && overview.users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                      No users found yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
