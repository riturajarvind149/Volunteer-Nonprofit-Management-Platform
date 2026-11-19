import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getTeamApi,
  inviteCoordinatorApi,
  revokeInvitationApi,
  removeMemberApi,
  transferOwnershipApi,
} from '../../services/api'
import Icon from '../../components/Icon'
import { Alert, EmptyState, LoadingState, PageHeader } from '../../components/ui'
import { formatDate } from '../../utils/format'
import { memberRoleLabel } from '../../utils/ngo'
import './Team.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const initials = (name = '') =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?'

function InviteForm({ onInvite }) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldError('Enter a valid email address.')
      return
    }
    setFieldError('')
    setSending(true)
    const ok = await onInvite(trimmed)
    setSending(false)
    if (ok) setEmail('')
  }

  return (
    <form className="team-invite" onSubmit={submit} noValidate aria-label="Invite a coordinator">
      <div className="field team-invite-field">
        <label className="field-label" htmlFor="invite-email">Invite a coordinator by email</label>
        <input
          id="invite-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setFieldError('')
          }}
          disabled={sending}
          autoComplete="off"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? 'invite-email-error' : 'invite-email-hint'}
          required
        />
        {fieldError ? (
          <span id="invite-email-error" className="field-error">{fieldError}</span>
        ) : (
          <span id="invite-email-hint" className="field-hint">
            They’ll get a link to join. Coordinators can publish events, manage rosters and record hours — not edit the NGO profile or team.
          </span>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        <Icon name="mail" size={15} /> {sending ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  )
}

/** Inline "are you sure?" for destructive actions. */
function Confirm({ text, confirmLabel, onConfirm, onCancel, busy }) {
  return (
    <div className="team-confirm" role="group" aria-label="Confirm">
      <span>{text}</span>
      <button type="button" className="btn btn-danger btn-sm" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  )
}

function Team() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null) // { tone, text }
  const [confirming, setConfirming] = useState(null) // { kind, id }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getTeamApi(id, token)
      setTeam(res?.data || null)
    } catch (err) {
      setError(err.message || 'The team could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action, successText, after) => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await action()
      setConfirming(null)
      if (after) return after(res)
      setNotice({ tone: 'success', text: successText(res) })
      await load()
      return true
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'That didn’t work. Please try again.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const invite = (email) => run(() => inviteCoordinatorApi(id, email, token), (res) => res?.message || `Invitation sent to ${email}.`)

  if (loading) return <LoadingState label="Loading team…" />
  if (!team) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Team" back={{ to: '/organization-profile', label: 'My organizations' }} />
        <div className="panel">
          <EmptyState icon="users" title="Team not available">{error || 'This NGO could not be found.'}</EmptyState>
        </div>
      </div>
    )
  }

  const isOwner = team.organization.my_role === 'OWNER'

  return (
    <div className="page page-narrow">
      <PageHeader
        title={`${team.organization.name} — Team`}
        description={
          isOwner
            ? 'Invite coordinators to run events with you. As NGO admin you also edit the NGO profile and manage this team.'
            : 'The people who run this NGO on ServeHub.'
        }
        back={{ to: '/organization-profile', label: 'My organizations' }}
      />

      {notice && <Alert tone={notice.tone === 'success' ? 'success' : 'error'}>{notice.text}</Alert>}
      {error && <Alert onRetry={load}>{error}</Alert>}

      {isOwner && (
        <section className="panel panel-body">
          <InviteForm onInvite={invite} />
        </section>
      )}

      <section className="panel" aria-labelledby="members-title">
        <div className="panel-header">
          <h2 id="members-title">Members</h2>
          <span className="muted">{team.members.length}</span>
        </div>
        <ul role="list" className="team-list">
          {team.members.map((m) => {
            const isMe = m.id === user?.id
            const confirmingThis = confirming?.id === m.id
            return (
              <li key={m.id} className="team-row">
                <span className="team-avatar" aria-hidden="true">{initials(m.full_name)}</span>
                <div className="team-main">
                  <span className="team-name">
                    {m.full_name}
                    {isMe && <span className="muted"> (you)</span>}
                  </span>
                  <span className="team-sub">
                    {m.email} · joined {formatDate(m.member_since, { month: 'short' })}
                  </span>
                </div>
                <span className={`badge ${m.role === 'OWNER' ? 'badge-success' : 'badge-info'}`}>{memberRoleLabel(m.role)}</span>

                {confirmingThis ? (
                  confirming.kind === 'transfer' ? (
                    <Confirm
                      text={`Make ${m.full_name} the NGO admin? You’ll become a coordinator.`}
                      confirmLabel="Yes, hand over"
                      busy={busy}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() =>
                        run(() => transferOwnershipApi(id, m.id, token), () => `${m.full_name} is now the NGO admin. You’re a coordinator.`)
                      }
                    />
                  ) : confirming.kind === 'leave' ? (
                    <Confirm
                      text="Leave this NGO? You’ll lose access to its events and hours."
                      confirmLabel="Yes, leave"
                      busy={busy}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() =>
                        run(
                          () => removeMemberApi(id, m.id, token),
                          null,
                          () => navigate('/organization-profile', { state: { message: `You left ${team.organization.name}.` } })
                        )
                      }
                    />
                  ) : (
                    <Confirm
                      text={`Remove ${m.full_name}?`}
                      confirmLabel="Yes, remove"
                      busy={busy}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => run(() => removeMemberApi(id, m.id, token), () => `${m.full_name} was removed from the team.`)}
                    />
                  )
                ) : (
                  <div className="team-actions">
                    {isOwner && m.role === 'COORDINATOR' && (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming({ kind: 'transfer', id: m.id })}>
                          Make NGO admin
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming({ kind: 'remove', id: m.id })}>
                          Remove
                        </button>
                      </>
                    )}
                    {!isOwner && isMe && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming({ kind: 'leave', id: m.id })}>
                        Leave NGO
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {isOwner && (
        <section className="panel" aria-labelledby="invites-title">
          <div className="panel-header">
            <h2 id="invites-title">Pending invitations</h2>
            <span className="muted">{team.invitations.length}</span>
          </div>
          {team.invitations.length === 0 ? (
            <p className="panel-body muted">No pending invitations.</p>
          ) : (
            <ul role="list" className="team-list">
              {team.invitations.map((inv) => (
                <li key={inv.id} className="team-row">
                  <span className="team-avatar team-avatar-pending" aria-hidden="true">
                    <Icon name="mail" size={15} />
                  </span>
                  <div className="team-main">
                    <span className="team-name">{inv.email}</span>
                    <span className="team-sub">
                      Sent {formatDate(inv.created_at, { month: 'short' })} · expires {formatDate(inv.expires_at, { month: 'short' })}
                    </span>
                  </div>
                  <div className="team-actions">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => invite(inv.email)}>
                      Resend
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => run(() => revokeInvitationApi(id, inv.id, token), () => `Invitation to ${inv.email} cancelled.`)}
                    >
                      Cancel invitation
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default Team
