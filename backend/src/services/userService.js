const bcrypt = require('bcrypt');
const pool = require('../config/db');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');
const { isSafeHttpUrl } = require('../utils/validators');

/**
 * Retrieve comprehensive user profile including impact metrics
 */
const getUserProfile = async (userId, role) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const stats = await userRepository.getUserStats(userId, role || user.role);

  return {
    ...user,
    stats,
  };
};

const LIMITS = { full_name: [2, 255], phone: [0, 30], location: [0, 255], bio: [0, 2000] };

const sanitizeProfileUpdate = (updateData) => {
  const cleanFields = {};

  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    if (updateData[field] === undefined) continue;
    if (updateData[field] === null && field !== 'full_name') {
      cleanFields[field] = null;
      continue;
    }
    if (typeof updateData[field] !== 'string') {
      throw new AppError(`${field.replace('_', ' ')} must be text`, 400);
    }
    const value = updateData[field].trim();
    if (value.length < min || value.length > max) {
      throw new AppError(`${field.replace('_', ' ')} must be between ${min} and ${max} characters`, 400);
    }
    cleanFields[field] = value || null;
  }

  if (cleanFields.phone && !/^[+()\-\s\d]{6,30}$/.test(cleanFields.phone)) {
    throw new AppError('Phone number contains invalid characters', 400);
  }

  if (updateData.skills !== undefined) {
    if (!Array.isArray(updateData.skills)) {
      throw new AppError('Skills must be an array of strings', 400);
    }
    const skills = [...new Set(updateData.skills.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))];
    if (skills.length > 30 || skills.some((s) => s.length > 50)) {
      throw new AppError('You can add up to 30 skills of at most 50 characters each', 400);
    }
    cleanFields.skills = skills;
  }

  if (updateData.avatar_url !== undefined) {
    if (updateData.avatar_url === null || updateData.avatar_url === '') {
      cleanFields.avatar_url = null;
    } else if (!isSafeHttpUrl(updateData.avatar_url)) {
      throw new AppError('Avatar URL must be a valid http(s) URL', 400);
    } else {
      cleanFields.avatar_url = updateData.avatar_url.trim();
    }
  }

  if (updateData.email_notifications !== undefined) {
    if (typeof updateData.email_notifications !== 'boolean') {
      throw new AppError('email_notifications must be true or false', 400);
    }
    cleanFields.email_notifications = updateData.email_notifications;
  }

  return cleanFields;
};

/**
 * Update authenticated user's profile details
 */
const updateUserProfile = async (userId, updateData) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const cleanFields = sanitizeProfileUpdate(updateData || {});
  const updatedUser = await userRepository.updateProfile(userId, cleanFields);
  const stats = await userRepository.getUserStats(userId, updatedUser.role);

  return {
    ...updatedUser,
    stats,
  };
};

/**
 * Collect all personal data held about a user (right of access / portability).
 */
const exportUserData = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const [signups, hours, notifications, waitlist, organizations] = await Promise.all([
    pool.query(
      `SELECT s.id, s.status, s.attendance_status, s.checked_in_at, s.created_at,
              o.title AS opportunity_title, o.event_date, org.name AS organization_name
         FROM signups s
         JOIN opportunities o ON o.id = s.opportunity_id
         JOIN organizations org ON org.id = o.organization_id
        WHERE s.volunteer_id = $1 ORDER BY s.created_at`,
      [userId]
    ),
    pool.query(
      `SELECT vh.id, vh.hours, vh.status, vh.notes, vh.self_reported, vh.created_at, o.title AS opportunity_title
         FROM volunteer_hours vh
         JOIN signups s ON s.id = vh.signup_id
         JOIN opportunities o ON o.id = s.opportunity_id
        WHERE s.volunteer_id = $1 ORDER BY vh.created_at`,
      [userId]
    ),
    pool.query(
      'SELECT title, message, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at',
      [userId]
    ),
    pool.query(
      `SELECT w.created_at, o.title AS opportunity_title FROM waitlist_entries w
         JOIN opportunities o ON o.id = w.opportunity_id WHERE w.volunteer_id = $1`,
      [userId]
    ),
    pool.query('SELECT id, name, verification_status, created_at FROM organizations WHERE coordinator_id = $1', [userId]),
  ]);

  return {
    exported_at: new Date().toISOString(),
    profile: user,
    organizations: organizations.rows,
    signups: signups.rows,
    volunteer_hours: hours.rows,
    waitlist: waitlist.rows,
    notifications: notifications.rows,
  };
};

/**
 * Permanently delete the user's account after re-confirming their password.
 */
const deleteAccount = async (userId, password) => {
  if (!password || typeof password !== 'string') {
    throw new AppError('Please confirm your password to delete your account', 400);
  }
  const hash = await userRepository.findPasswordHashById(userId);
  if (!hash) throw new AppError('User not found', 404);
  if (!(await bcrypt.compare(password, hash))) {
    throw new AppError('Password is incorrect', 400);
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM organizations WHERE coordinator_id = $1', [userId]);
  if (rows[0].n > 0) {
    throw new AppError(
      'You still manage an organization. Transfer or close it (contact support) before deleting your account.',
      409
    );
  }

  await userRepository.deleteUserCascade(userId);
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  exportUserData,
  deleteAccount,
};
