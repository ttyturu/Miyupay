import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields: Record<string, string> = {};
    for (const err of errors.array()) {
      if ('path' in err) fields[err.path] = err.msg;
    }
    res.status(400).json({ error: 'Validation failed', fields });
    return;
  }
  next();
};
