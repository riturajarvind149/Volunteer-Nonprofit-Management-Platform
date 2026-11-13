const { config } = require('../config/env');

/**
 * Builders for every transactional email the platform sends.
 * Each returns an object accepted by emailService.sendEmail (minus `to`).
 */

const link = (path) => `${config.appUrl}${path}`;

const formatDate = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (value) => (value ? String(value).slice(0, 5) : '');

const eventLine = (opp) =>
  `${formatDate(opp.event_date)}, ${formatTime(opp.start_time)}–${formatTime(opp.end_time)} at ${opp.location}`;

module.exports = {
  verifyEmail: ({ name, token }) => ({
    subject: `Verify your email for ${config.appName}`,
    heading: 'Confirm your email address',
    paragraphs: [
      `Hi ${name},`,
      `Thanks for joining ${config.appName}! Please confirm your email address to activate your account. This link expires in 24 hours.`,
    ],
    cta: { label: 'Verify email', url: link(`/verify-email?token=${encodeURIComponent(token)}`) },
    footer: "If you didn't create an account, you can safely ignore this email.",
  }),

  passwordReset: ({ name, token }) => ({
    subject: `Reset your ${config.appName} password`,
    heading: 'Reset your password',
    paragraphs: [
      `Hi ${name},`,
      'We received a request to reset your password. This link expires in 60 minutes and can only be used once.',
    ],
    cta: { label: 'Choose a new password', url: link(`/reset-password?token=${encodeURIComponent(token)}`) },
    footer: "If you didn't request this, you can ignore this email — your password won't change.",
  }),

  passwordChanged: ({ name }) => ({
    subject: `Your ${config.appName} password was changed`,
    heading: 'Password changed',
    paragraphs: [
      `Hi ${name},`,
      'Your password was just changed and all other sessions were signed out.',
      "If this wasn't you, reset your password immediately and contact support.",
    ],
    cta: { label: 'Reset password', url: link('/forgot-password') },
  }),

  signupConfirmed: ({ name, opp }) => ({
    subject: `You're registered: ${opp.title}`,
    heading: "You're registered!",
    paragraphs: [
      `Hi ${name},`,
      `You're confirmed for "${opp.title}" with ${opp.organization_name || 'the organizer'}.`,
      `When: ${eventLine(opp)}`,
      'A calendar invite is attached. We will remind you the day before.',
    ],
    cta: { label: 'View opportunity', url: link(`/opportunities/${opp.id}`) },
  }),

  waitlistPromoted: ({ name, opp }) => ({
    subject: `A spot opened up: ${opp.title}`,
    heading: "Good news — you're in!",
    paragraphs: [
      `Hi ${name},`,
      `A spot opened up for "${opp.title}" and you've been moved from the waitlist to registered.`,
      `When: ${eventLine(opp)}`,
      "If you can no longer attend, please cancel so someone else can take the spot.",
    ],
    cta: { label: 'View opportunity', url: link(`/opportunities/${opp.id}`) },
  }),

  eventReminder: ({ name, opp }) => ({
    subject: `Reminder: ${opp.title} is coming up`,
    heading: 'Your volunteer shift is coming up',
    paragraphs: [
      `Hi ${name},`,
      `This is a reminder that you're registered for "${opp.title}".`,
      `When: ${eventLine(opp)}`,
      opp.address ? `Address: ${opp.address}` : '',
      "Can't make it? Please cancel from My Signups so someone on the waitlist can join.",
    ].filter(Boolean),
    cta: { label: 'View details', url: link(`/opportunities/${opp.id}`) },
  }),

  eventCancelled: ({ name, opp, reason }) => ({
    subject: `Cancelled: ${opp.title}`,
    heading: 'An opportunity you signed up for was cancelled',
    paragraphs: [
      `Hi ${name},`,
      `Unfortunately "${opp.title}" scheduled for ${formatDate(opp.event_date)} has been cancelled by the organizer.`,
      reason ? `Reason: ${reason}` : '',
      'Browse other opportunities to find a new way to help.',
    ].filter(Boolean),
    cta: { label: 'Browse opportunities', url: link('/opportunities') },
  }),

  eventUpdated: ({ name, opp }) => ({
    subject: `Updated: ${opp.title}`,
    heading: 'Event details changed',
    paragraphs: [
      `Hi ${name},`,
      `The organizer updated the schedule or location for "${opp.title}".`,
      `New details: ${eventLine(opp)}`,
    ],
    cta: { label: 'View opportunity', url: link(`/opportunities/${opp.id}`) },
  }),

  hoursReviewed: ({ name, hours, title, status }) => ({
    subject: `Your volunteer hours were ${status === 'VERIFIED' ? 'verified' : 'reviewed'}`,
    heading: status === 'VERIFIED' ? 'Hours verified 🎉' : 'Hours update',
    paragraphs: [
      `Hi ${name},`,
      status === 'VERIFIED'
        ? `${hours} hours for "${title}" have been verified. They now count toward your certificate.`
        : `Your ${hours} hours for "${title}" were marked as ${status.toLowerCase()}. Contact the organizer if you have questions.`,
    ],
    cta: { label: 'View my hours', url: link('/my-hours') },
  }),

  orgSubmitted: ({ orgName, coordinatorName }) => ({
    subject: `New organization awaiting review: ${orgName}`,
    heading: 'Organization pending verification',
    paragraphs: [`${coordinatorName} registered "${orgName}". Please review it in the admin console.`],
    cta: { label: 'Open admin console', url: link('/admin') },
  }),

  orgReviewed: ({ name, orgName, status, note }) => ({
    subject: `Your organization "${orgName}" was ${status.toLowerCase()}`,
    heading: status === 'APPROVED' ? 'Your organization is verified ✅' : `Organization ${status.toLowerCase()}`,
    paragraphs: [
      `Hi ${name},`,
      status === 'APPROVED'
        ? `"${orgName}" has been verified. You can now publish opportunities and recruit volunteers.`
        : `"${orgName}" was marked as ${status.toLowerCase()}. Published opportunities are hidden until it is approved again.`,
      note ? `Note from the reviewer: ${note}` : '',
    ].filter(Boolean),
    cta: { label: 'Go to dashboard', url: link('/dashboard') },
  }),

  formatDate,
  formatTime,
};
