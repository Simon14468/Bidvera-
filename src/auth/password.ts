import bcrypt from "bcryptjs";

const ROUNDS = 12;

/**
 * Cost-12 hash of a non-user secret. Used only to equalize login timing when
 * no account exists — never a valid stored password.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$6Et75kZsq280BtgKIak3Pu1rNZgE3lk2OPNeqqU5i5sNcJhsQCdLi";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Always run bcrypt compare so missing-user logins do not skip hashing work. */
export async function verifyPasswordAgainstKnownOrDummy(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  return verifyPassword(password, passwordHash || DUMMY_PASSWORD_HASH);
}
