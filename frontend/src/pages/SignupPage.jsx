import { useState } from 'react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import './SignupPage.css';

/**
 * SignupPage Component
 * Provides user registration interface with role selection and form validation.
 */
function SignupPage({ onNavigate }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'VOLUNTEER',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.role) {
      newErrors.role = 'Please select a role.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Client-side validation passed.
      // Backend registration endpoint integration will be connected when endpoints are ready.
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-subtitle">
            Register as a volunteer or nonprofit coordinator
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="signup-fullname"
            name="fullName"
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={formData.fullName}
            onChange={handleChange}
            error={errors.fullName}
            required
          />

          <Input
            id="signup-email"
            name="email"
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            required
          />

          <div className="form-group">
            <label htmlFor="signup-role" className="form-label">
              Role <span aria-hidden="true">*</span>
            </label>
            <select
              id="signup-role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="form-select"
            >
              <option value="VOLUNTEER">Volunteer</option>
              <option value="COORDINATOR">Nonprofit Coordinator</option>
            </select>
            {errors.role && <span className="form-error">{errors.role}</span>}
          </div>

          <Input
            id="signup-password"
            name="password"
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            required
          />

          <Input
            id="signup-confirm-password"
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="auth-submit-btn"
          >
            Create Account
          </Button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => onNavigate && onNavigate('login')}
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
