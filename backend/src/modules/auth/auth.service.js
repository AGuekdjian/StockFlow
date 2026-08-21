import argon2 from 'argon2';
import { AppError } from '../../shared/errors/app-error.js';

const publicUser = ({ passwordHash: _passwordHash, ...user }) => user;

export class AuthService {
  constructor({ users, logger }) {
    this.users = users;
    this.logger = logger;
    this.dummyHash = argon2.hash('timing-equalization-password');
  }
  async login({ email, password, requestId }) {
    const user = await this.users.findByEmailWithPassword(email);
    const valid = await argon2
      .verify(user?.passwordHash ?? (await this.dummyHash), password)
      .catch(() => false);
    if (!valid || !user.active) {
      this.logger.warn(
        { event: 'auth.login.failed', requestId, email },
        'Inicio de sesión rechazado',
      );
      throw new AppError({
        code: 'UNAUTHORIZED',
        message: 'Email o contraseña incorrectos.',
        status: 401,
      });
    }
    this.logger.info(
      { event: 'auth.login.success', requestId, userId: String(user._id) },
      'Inicio de sesión correcto',
    );
    return publicUser(user);
  }
  async hashPassword(password) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}
