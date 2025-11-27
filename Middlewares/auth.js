
 import {verifyAccessToken} from '../utils/jwt.js'

const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) return res.status(401).json({ message: 'Invalid authorization header' });

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Access token invalid or expired' });
  }
};

export {requireAuth};
