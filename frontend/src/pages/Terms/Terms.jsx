import { Link } from 'react-router-dom'
import '../Privacy/Legal.css'

const LAST_UPDATED = 'October 2026'

function Terms() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <div className="legal-draft-banner" role="note">
          <strong>Draft document.</strong> These Terms of Use have not been reviewed by legal
          counsel and are not legally sufficient for a public launch in their current form.
          Placeholder sections are marked clearly and must be resolved before launch.
        </div>

        <header className="legal-header">
          <Link to="/" className="legal-back-link">Back to ServeHub</Link>
          <h1>Terms of Use</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="legal-body">
          <section className="legal-section">
            <h2>About These Terms</h2>
            <p>
              These Terms of Use govern your access to and use of the ServeHub web application.
              By creating an account or using the platform, you agree to these terms.
            </p>
            <p>
              ServeHub is currently in development and not yet publicly launched. These terms
              will be revised and reviewed before any public release.
            </p>
          </section>

          <section className="legal-section">
            <h2>The Platform</h2>
            <p>
              ServeHub is a volunteer and nonprofit management platform. It allows:
            </p>
            <ul>
              <li>
                <strong>Volunteers</strong> to discover and register for volunteer opportunities
                posted by organizations, and to view their volunteering activity and hours.
              </li>
              <li>
                <strong>Coordinators</strong> to create and manage organizations, post volunteer
                opportunities, manage volunteer signups, and record volunteer hours.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Account Registration</h2>
            <p>
              You must create an account to use most features of ServeHub. When registering,
              you agree to:
            </p>
            <ul>
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your password</li>
              <li>Notify the ServeHub team promptly of any unauthorized use of your account</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
            <p>
              You may register as a Volunteer or as a Coordinator. You are responsible for
              selecting the appropriate role for your intended use.
            </p>
          </section>

          <section className="legal-section">
            <h2>Volunteer Conduct</h2>
            <p>As a volunteer using ServeHub, you agree to:</p>
            <ul>
              <li>Only register for opportunities you genuinely intend to attend</li>
              <li>Cancel your registration promptly if you are unable to attend</li>
              <li>Represent yourself honestly when interacting with organizations</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Coordinator Conduct</h2>
            <p>As a coordinator using ServeHub, you agree to:</p>
            <ul>
              <li>Only create organizations that you are authorized to represent</li>
              <li>Post accurate and complete information about volunteer opportunities</li>
              <li>Treat volunteer information with appropriate care and confidentiality</li>
              <li>Record volunteer hours accurately and fairly</li>
              <li>Not use volunteer contact information for purposes unrelated to ServeHub</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Prohibited Use</h2>
            <p>You may not use ServeHub to:</p>
            <ul>
              <li>Post false, misleading, or fraudulent information</li>
              <li>Harass, intimidate, or harm other users</li>
              <li>Attempt to gain unauthorized access to any part of the platform</li>
              <li>Use the platform for commercial solicitation unrelated to volunteering</li>
              <li>Violate any applicable law or regulation</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Intellectual Property</h2>
            <p>
              The ServeHub application and its source code are the property of their respective
              owners. You may not reproduce, distribute, or create derivative works without
              authorization.
            </p>
            <p>
              Content you submit to ServeHub (such as organization names, opportunity descriptions)
              remains your responsibility. By submitting content, you confirm you have the right
              to do so.
            </p>
          </section>

          <section className="legal-section">
            <h2>Payments</h2>
            <p>
              ServeHub does not currently process payments. No payment information is collected
              through the platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>Disclaimers</h2>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] A warranty disclaimer and limitation of liability clause
              must be drafted by qualified legal counsel based on the applicable jurisdiction
              before this platform is launched. The following is a placeholder only:
            </p>
            <p>
              ServeHub is provided &ldquo;as is&rdquo; during the development phase without any
              warranties, express or implied. We do not guarantee the availability, accuracy, or
              reliability of the platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>Governing Law and Jurisdiction</h2>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] The governing law and jurisdiction for disputes must
              be specified based on where the operating entity is registered. Do not fill
              this in without authorization from appropriate legal counsel.
            </p>
          </section>

          <section className="legal-section">
            <h2>Account Termination</h2>
            <p>
              The ServeHub team reserves the right to suspend or terminate accounts that
              violate these Terms of Use or that are used in a way that harms the platform
              or its users.
            </p>
            <p>
              You may request deletion of your account by contacting the ServeHub team.
            </p>
          </section>

          <section className="legal-section">
            <h2>Changes to These Terms</h2>
            <p>
              These terms may be updated as the platform develops. The date at the top of
              this page reflects when they were last revised. Continued use of ServeHub
              after an update constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contact</h2>
            <p className="legal-placeholder">
              [REQUIRES LEGAL REVIEW] Provide a verified contact method for legal inquiries
              before launch.
            </p>
          </section>
        </div>

        <div className="legal-footer-nav">
          <Link to="/privacy">View Privacy Policy</Link>
          <Link to="/">Back to Home</Link>
        </div>
      </div>
    </main>
  )
}

export default Terms
