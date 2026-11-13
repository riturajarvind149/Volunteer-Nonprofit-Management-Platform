const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True only for absolute http/https URLs (blocks javascript:, data:, etc.). */
const isSafeHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

/** Parse ?page=&limit= with sane bounds. */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

const paginationMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  total_pages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { UUID_REGEX, EMAIL_REGEX, isSafeHttpUrl, isUuid, parsePagination, paginationMeta };
