const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Middleware ตรวจสอบ JWT Token
 * ถ้าผ่าน → ใส่ req.user = decoded payload
 * ถ้าไม่ผ่าน → ส่ง 401
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'กรุณา Login ก่อน — ไม่พบ Token ใน Authorization header'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;  // ต่อ pipeline
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Token หมดอายุ กรุณา Login ใหม่'
      });
    }
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Token ไม่ถูกต้อง'
    });
  }
}

/**
 * Middleware ตรวจสอบ Role
 * @param  {...string} roles - roles ที่อนุญาต เช่น 'admin', 'member'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `ต้องการสิทธิ์: ${roles.join(' หรือ ')} (คุณมีสิทธิ์: ${req.user.role})`
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };