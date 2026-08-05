import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';

// Checked fresh against the DB (not trusted from the JWT) so that revoking
// admin access takes effect immediately, without waiting for the token to expire.
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows: [user] } = await db.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (user?.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch (err) { next(err); }
};
