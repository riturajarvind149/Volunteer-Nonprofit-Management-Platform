import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerMyNgoApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Alert, PageHeader } from '../../components/ui'
import NgoFields from '../../components/NgoFields'
import { EMPTY_NGO, ngoPayload, validateNgo } from '../../utils/ngo'
import '../Auth.css'

/** A signed-in coordinator who isn't part of an NGO registers one and becomes its NGO admin. */
function RegisterMyNgo() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [ngo, setNgo] = useState(EMPTY_NGO)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const change = (field, value) => {
    setNgo((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateNgo(ngo)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setError('')
    setLoading(true)
    try {
      const res = await registerMyNgoApi(ngoPayload(ngo), token)
      const pending = res?.data?.organization?.verification_status === 'PENDING'
      navigate('/organization-profile', {
        state: {
          message: pending
            ? 'Your NGO is registered and waiting for verification by the ServeHub team.'
            : 'Your NGO is registered.',
        },
      })
    } catch (err) {
      setLoading(false)
      if (err.code === 'ORG_NAME_TAKEN') setErrors((prev) => ({ ...prev, name: err.message }))
      else setError(err.message || 'Your NGO could not be registered. Please try again.')
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Register your NGO"
        description="You’ll become its NGO admin. The ServeHub team verifies every NGO before it can publish opportunities."
        back={{ to: '/organization-profile', label: 'My organizations' }}
      />

      {error && <Alert>{error}</Alert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <NgoFields values={ngo} errors={errors} onChange={change} disabled={loading} />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering…' : 'Register NGO'}
          </button>
          <Link to="/organization-profile" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}

export default RegisterMyNgo
