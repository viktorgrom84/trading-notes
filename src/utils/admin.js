// Admin utility functions
export const ADMIN_USERNAME = 'viktorgrom84@gmail.com';

export const isAdmin = (username) => {
  return username === ADMIN_USERNAME;
};

export const checkAdminAccess = (user) => {
  if (!user || !user.username) {
    return false;
  }
  return isAdmin(user.username);
};
