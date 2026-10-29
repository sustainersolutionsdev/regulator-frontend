/**
 * T066 (Niranjan, Oct 27): pages only Admin and SME can use. The menu hides
 * them from Users (layout/AppLayout.jsx), and App.jsx sends a User who opens
 * one by its address back to the Roadmap. The server enforces the same rule
 * on every call (FR-0.3, FR-0.7).
 */
export const ADMIN_SME_PATHS = ['/add-regulation', '/settings'];

export function isAdminOrSme(role) {
  return role === 'admin' || role === 'sme';
}
