import { useState } from 'react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import './LoginPage.css';

/**
 * LoginPage Component
 * Provides user login interface with client-side form validation.
 */
function LoginPage({ onNavigate }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
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
      // Backend auth endpoint integration will be connected when endpoints are ready.
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Log In</h1>
          <p className="auth-subtitle">
            Sign in to access your account and dashboard
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="login-email"
            name="email"
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            required
          />

          <Input
            id="login-password"
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            required
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="auth-submit-btn"
          >
            Log In
          </Button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => onNavigate && onNavigate('signup')}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
