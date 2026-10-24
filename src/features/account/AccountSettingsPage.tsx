import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

function ProfileSettings() {
  const { profile, profileState, profileError, updateDisplayName, client } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (profileState === 'ready') setDisplayName(profile?.display_name ?? '')
  }, [profile, profileState])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) {
      setError('Enter a display name to save.')
      setSaved(false)
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateDisplayName(name)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your profile could not be updated. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!client || deleting) return
    const confirmed = window.confirm('Permanently delete your SpeakDaily account, saved sessions, transcripts, feedback, and private recordings? This cannot be undone.')
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data, error: deletionError } = await client.functions.invoke('delete-account', {
        body: { confirm_delete: true },
      })
      if (deletionError || !data || typeof data !== 'object' || data.deleted !== true) {
        throw new Error('account_deletion_incomplete')
      }
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
      navigate('/', { replace: true })
    } catch {
      setDeleteError('We could not confirm account deletion. Some private recordings or app data may already have been removed. If you can still sign in, retrying deletion is safe.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="profile-panel" aria-labelledby="profile-heading">
      <p className="eyebrow">Your account</p>
      <h2 id="profile-heading">Profile details</h2>
      {profileState === 'loading' && <p role="status">Loading your profile…</p>}
      {profileState === 'error' && <p className="form-error" role="alert">{profileError}</p>}
      {profileState === 'ready' && (
        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="form-field" htmlFor="display-name">
            <span>Display name</span>
            <input
              id="display-name"
              autoComplete="name"
              maxLength={80}
              onChange={(event) => { setDisplayName(event.target.value); setSaved(false) }}
              required
              value={displayName}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p className="form-notice" role="status">Your display name has been updated.</p>}
          <button className="button-link" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save display name'}
          </button>
        </form>
      )}
      <div className="account-privacy-actions">
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <p>Deleting your account removes its saved practice data and private recordings. Read the <Link to="/privacy">privacy notice</Link> for details about provider processing and backup limits.</p>
        <button className="danger-button" disabled={deleting} onClick={() => { void handleDeleteAccount() }} type="button">
          {deleting ? 'Deleting account…' : 'Delete account'}
        </button>
      </div>
    </section>
  )
}

export function AccountSettingsPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <p className="eyebrow">Account settings</p>
        <h1>Manage your account.</h1>
        <p className="dashboard-lede">Update your display name or permanently delete your account and saved practice data.</p>
      </header>
      <ProfileSettings />
    </div>
  )
}
