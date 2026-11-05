// Grants the ADMIN role to an EXISTING account. There is deliberately no HTTP endpoint for this:
// only someone with shell + database access can create Legal Buddy Connect administrators.
//
//   npm run admin:promote -- someone@example.com
//   npm run admin:promote -- someone@example.com --revoke
import 'dotenv/config';
import process from 'node:process';

const [email, flag] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:promote -- <email> [--revoke]');
  process.exit(1);
}

const { default: prisma } = await import('../src/prisma/client.js');
try {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
  if (!user) {
    console.error('No account exists with that email. Register it first through the normal sign-up page.');
    process.exitCode = 1;
  } else if (flag === '--revoke') {
    if (user.role !== 'ADMIN') console.log('That account is not an admin; nothing changed.');
    else { await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } }); console.log('Admin role revoked (account is now USER).'); }
  } else if (user.role === 'LAWYER') {
    console.error('Lawyer accounts cannot be admins. Use a separate account so nobody can verify their own profile.');
    process.exitCode = 1;
  } else if (user.role === 'ADMIN') {
    console.log('That account is already an admin.');
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log('Account promoted to ADMIN. Sign out and back in to see the admin pages.');
  }
} finally {
  await prisma.$disconnect();
}
