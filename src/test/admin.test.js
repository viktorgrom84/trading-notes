/**
 * Tests for src/utils/admin.js
 * Covers: isAdmin(), checkAdminAccess()
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAdmin, checkAdminAccess } from '../utils/admin'

// We control the env variable through import.meta.env
// Vitest exposes it via vi.stubEnv / import.meta.env
describe('isAdmin()', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ADMIN_USERNAME', 'admin_user')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true when username matches VITE_ADMIN_USERNAME', () => {
    expect(isAdmin('admin_user')).toBe(true)
  })

  it('returns false for a different username', () => {
    expect(isAdmin('regular_user')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isAdmin('Admin_User')).toBe(false)
    expect(isAdmin('ADMIN_USER')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAdmin('')).toBe(false)
  })

  it('returns false when env var is not set', () => {
    vi.unstubAllEnvs()
    // With no env var, adminUsername is undefined; no username matches undefined
    expect(isAdmin('admin_user')).toBe(false)
  })
})

describe('checkAdminAccess()', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ADMIN_USERNAME', 'admin_user')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false for null user', () => {
    expect(checkAdminAccess(null)).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(checkAdminAccess(undefined)).toBe(false)
  })

  it('returns false for user without username property', () => {
    expect(checkAdminAccess({})).toBe(false)
    expect(checkAdminAccess({ id: 1 })).toBe(false)
  })

  it('returns false for non-admin user', () => {
    expect(checkAdminAccess({ username: 'regular_user' })).toBe(false)
  })

  it('returns true for admin user', () => {
    expect(checkAdminAccess({ username: 'admin_user' })).toBe(true)
  })

  it('returns true when user has extra properties', () => {
    expect(checkAdminAccess({ id: 42, username: 'admin_user', email: 'a@b.com' })).toBe(true)
  })
})
