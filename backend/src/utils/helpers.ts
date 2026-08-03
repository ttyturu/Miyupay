import crypto from 'crypto';

export const generateReference = (): string => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `MP-${year}-${random}`;
};
