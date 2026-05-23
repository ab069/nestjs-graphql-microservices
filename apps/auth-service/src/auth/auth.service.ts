import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Session } from './entities/session.entity';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse } from './dto/auth-response.type';

/**
 * Shape stored in the JWT payload and propagated across all services
 * via the forwarded Authorization header.
 */
export interface JwtPayload {
  sub: string;        // user ID
  email: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * In-memory user store — replace with a real HTTP/gRPC call to the
 * users-service in production. Kept simple here to focus on the
 * auth patterns rather than inter-service transport boilerplate.
 */
interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  role: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Simulated user store — swap for users-service client call
  private readonly users: Map<string, UserRecord> = new Map();

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, firstName, lastName, tenantId } = input;

    // Uniqueness check — in production delegate to users-service
    const existingUser = Array.from(this.users.values()).find(
      (u) => u.email === email,
    );
    if (existingUser) {
      throw new ConflictException(
        `An account with email "${email}" already exists`,
      );
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, saltRounds);
    } catch (err) {
      this.logger.error('bcrypt hashing failed', err);
      throw new InternalServerErrorException('Could not create account');
    }

    const userId = uuidv4();
    const resolvedTenantId = tenantId ?? uuidv4(); // default tenant per user

    const user: UserRecord = {
      id: userId,
      email,
      passwordHash,
      tenantId: resolvedTenantId,
      role: 'member',
      firstName,
      lastName,
    };

    this.users.set(userId, user);
    this.logger.log(
      `User registered: ${email} (id=${userId}, tenant=${resolvedTenantId})`,
    );

    return this.issueTokenPair(user);
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const user = await this.validateUser(email, password);
    if (!user) {
      // Generic message — don't reveal whether the email exists
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Login: ${email} (id=${user.id}, tenant=${user.tenantId})`);
    return this.issueTokenPair(user);
  }

  // ---------------------------------------------------------------------------
  // validateUser — called by the Passport local strategy
  // ---------------------------------------------------------------------------

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserRecord | null> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    if (!user) return null;

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    return passwordMatch ? user : null;
  }

  // ---------------------------------------------------------------------------
  // validateJwtPayload — called by the Passport JWT strategy on every request
  // ---------------------------------------------------------------------------

  async validateJwtPayload(payload: JwtPayload): Promise<UserRecord | null> {
    const user = this.users.get(payload.sub);
    // Ensure the token's tenantId matches the stored user — prevents
    // cross-tenant token reuse after a tenant transfer
    if (!user || user.tenantId !== payload.tenantId) {
      return null;
    }
    return user;
  }

  // ---------------------------------------------------------------------------
  // Refresh token
  // ---------------------------------------------------------------------------

  async refreshTokens(rawRefreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash: tokenHash, isActive: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = this.users.get(session.userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Rotate — invalidate old session, issue fresh pair
    await this.sessionRepository.update(session.id, { isActive: false });
    return this.issueTokenPair(user, session.ipAddress, session.userAgent);
  }

  // ---------------------------------------------------------------------------
  // Logout — invalidates the current session
  // ---------------------------------------------------------------------------

  async logout(userId: string, tenantId: string): Promise<boolean> {
    await this.sessionRepository.update(
      { userId, tenantId, isActive: true },
      { isActive: false },
    );
    this.logger.log(`Logout: userId=${userId} tenant=${tenantId}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async issueTokenPair(
    user: UserRecord,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const rawRefreshToken = uuidv4();
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day refresh window

    await this.sessionRepository.save(
      this.sessionRepository.create({
        userId: user.id,
        tenantId: user.tenantId,
        refreshTokenHash,
        ipAddress,
        userAgent,
        isActive: true,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900, // 15 minutes in seconds
      tokenType: 'Bearer',
      userId: user.id,
      tenantId: user.tenantId,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
