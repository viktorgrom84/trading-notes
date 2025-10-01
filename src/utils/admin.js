// Admin utility functions
export const isAdmin = (username) => {
  const adminUsername = import.meta.env.VITE_ADMIN_USERNAME || process.env.ADMIN_USERNAME;
  console.log('Admin Check:', { username, adminUsername, isMatch: username === adminUsername });
  return username === adminUsername;
};

export const checkAdminAccess = (user) => {
  if (!user || !user.username) {
    return false;
  }
  return isAdmin(user.username);
};
