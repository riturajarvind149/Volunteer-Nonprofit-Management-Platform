import { Link } from 'react-router-dom'
import './Legal.css'

const LAST_UPDATED = 'October 2026'

function Privacy() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <div className="legal-draft-banner" role="note">
          <strong>Draft document.</strong> This Privacy Policy has not been reviewed by legal
          counsel. It must be completed and reviewed before the platform is publicly launched.
          Placeholder sections are marked clearly.
        </div>

        <header className="legal-header">
          <Link to="/" className="legal-back-link">Back to ServeHub</Link>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="legal-body">
          <section className="legal-section">
            <h2>About This Document</h2>
            <p>
              This Privacy Policy describes what information ServeHub collects from users,
              how that information is used, and what choices users have. It applies to the
              ServeHub web application currently in development.
            </p>
            <p>
              The platform is not yet publicly launched. This document reflects the current
              state of the application and will be updated before any public release.
            </p>
          </section>

          <section className="legal-section">
            <h2>Information We Collect</h2>
            <p>The following information is collected based on inspection of the actual application:</p>

            <h3>Account Registration</h3>
            <p>When you create an account, you provide:</p>
            <ul>
              <li>Full name</li>
              <li>Email address</li>
              <li>Password (stored as a hashed value — the plain-text password is not retained)</li>
              <li>Account role (Volunteer or Coordinator)</li>
            </ul>

            <h3>Organization Information (Coordinators only)</h3>
            <p>
              If you register as a Coordinator and create an organization, you provide an
              organization name and description. This information is stored in the application
              database and is visible to other authenticated users.
            </p>

            <h3>Volunteer Activity</h3>
            <p>
              When you sign up for opportunities as a Volunteer, the application records which
              opportunities you have registered for and your signup status. Coordinators of
              those opportunities can view this information.
            </p>

            <h3>Volunteer Hours</h3>
            <p>
              Coordinators may record volunteer hours on behalf of volunteers. These records
              include the number of hours and their verification status. Volunteers can view
              their own hour records.
            </p>

            <h3>Authentication</h3>
            <p>
              The application uses JSON Web Tokens (JWT) for session authentication. Tokens
              are stored in the browser&apos;s local storage. No HTTP-only cookies are used
              for authentication at this time.
            </p>
          </section>

          <section className="legal-section">
            <h2>How Information Is Used</h2>
            <p>Information collected is used to:</p>
            <ul>
              <li>Authenticate users and maintain sessions</li>
              <li>Display relevant opportunities and organizations</li>
              <li>Allow coordinators to manage volunteer signups and record hours</li>
              <li>Allow volunteers to track their activity history</li>
            </ul>
            <p>
              ServeHub does not currently use your information for advertising, profiling,
              or sale to third parties.
            </p>
          </section>

          <section className="legal-section">
            <h2>Who Can See Your Information</h2>
            <ul>
              <li>
                <strong>Volunteer profile data</strong> (name, email, role): Visible to authenticated
                coordinators when they view signups for their opportunities.
              </li>
              <li>
                <strong>Signup and hours records</strong>: Visible to the volunteer who created
                them and to coordinators who manage the related opportunities.
              </li>
              <li>
                <strong>Organization information</strong>: Visible to all authenticated users.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Analytics and Third-Party Services</h2>
            <p>
              Based on inspection of the application code, no analytics services (such as
              Google Analytics) or third-party tracking scripts are currently integrated.
            </p>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] If any analytics, monitoring, or external services
              are added before launch, this section must be updated to name them and describe
              their data practices.
            </p>
          </section>

          <section className="legal-section">
            <h2>Data Storage and Security</h2>
            <p>
              Application data is stored in a database managed by the ServeHub development
              team. Passwords are hashed before storage.
            </p>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] The following information must be confirmed before
              launch: the hosting provider and jurisdiction, whether data is encrypted at
              rest, the data retention policy, and the process for handling security
              incidents.
            </p>
          </section>

          <section className="legal-section">
            <h2>Your Rights and Choices</h2>
            <p>
              You may request access to, correction of, or deletion of your personal
              information by contacting the ServeHub team.
            </p>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] A contact method for data requests must be provided
              before launch. If the application serves users in certain jurisdictions (such
              as the EU/EEA or California), specific legal rights and processes must be
              described here.
            </p>
          </section>

          <section className="legal-section">
            <h2>Children</h2>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] Confirm whether the platform is intended for use by
              minors and what age restrictions apply.
            </p>
          </section>

          <section className="legal-section">
            <h2>Changes to This Policy</h2>
            <p>
              This policy will be updated as the application evolves. The date at the top
              of this page reflects when it was last revised. Continued use of the platform
              after an update constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contact</h2>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] Provide a verified contact email address or postal
              address for privacy-related inquiries before launch.
            </p>
          </section>
        </div>

        <div className="legal-footer-nav">
          <Link to="/terms">View Terms of Use</Link>
          <Link to="/">Back to Home</Link>
        </div>
      </div>
    </main>
  )
}

export default Privacy
