const checkRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.user.role; // Assuming req.user is set by authMiddleware

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
};

module.exports = {
  checkRole,
  isAdmin
};