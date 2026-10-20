import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [] // Controller errors are sanitized; Prisma validation logs may include document text.,
});

export default prisma;
