import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from 'node:crypto';
import { promisify } from 'node:util';
import { eq, lt } from 'drizzle-orm';
import { users, sessions, authAttempts, type Store } from '@family/database';
import { DomainError } from '../errors';
const scrypt = promisify(scryptCallback);
export async function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(pin, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPin(pin: string, hash: string) {
  const [salt, expected] = hash.split(':');
  const key = (await scrypt(pin, salt, 64)) as Buffer;
  const actual = Buffer.from(expected, 'hex');
  return key.length === actual.length && timingSafeEqual(key, actual);
}
export class AuthService {
  constructor(
    private store: Store,
    private secret: string,
    private now: () => string,
  ) {}
  tokenHash(token: string) {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }
  actor(token?: string) {
    if (!token) return null;
    const session = this.store.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, this.tokenHash(token)))
      .get();
    if (!session || session.expiresAt <= this.now()) return null;
    const user = this.store.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .get();
    return user?.active ? user : null;
  }
  async login(userId: string, pin: string) {
    const attempt = this.store.db
      .select()
      .from(authAttempts)
      .where(eq(authAttempts.userId, userId))
      .get();
    const now = this.now();
    if (attempt && attempt.count >= 5 && attempt.blockedUntil > now)
      throw new DomainError(
        429,
        'Too many PIN attempts. Try again in 15 minutes.',
      );
    const user = this.store.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    // Reserve an attempt before expensive hashing so concurrent requests cannot bypass the limit.
    const count = attempt && attempt.blockedUntil > now ? attempt.count + 1 : 1;
    this.store.db
      .insert(authAttempts)
      .values({
        userId,
        count,
        blockedUntil: new Date(Date.parse(now) + 15 * 60000).toISOString(),
      })
      .onConflictDoUpdate({
        target: authAttempts.userId,
        set: {
          count,
          blockedUntil: new Date(Date.parse(now) + 15 * 60000).toISOString(),
        },
      })
      .run();
    if (!user?.active || !user.pinHash || !(await verifyPin(pin, user.pinHash)))
      throw new DomainError(401, 'PIN not recognized');
    this.store.db
      .delete(authAttempts)
      .where(eq(authAttempts.userId, userId))
      .run();
    const token = randomBytes(32).toString('hex');
    this.store.db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
    this.store.db
      .insert(sessions)
      .values({
        tokenHash: this.tokenHash(token),
        userId,
        expiresAt: new Date(Date.parse(now) + 15 * 60000).toISOString(),
      })
      .run();
    return { token, user };
  }
  logout(token?: string) {
    if (token)
      this.store.db
        .delete(sessions)
        .where(eq(sessions.tokenHash, this.tokenHash(token)))
        .run();
  }
}
