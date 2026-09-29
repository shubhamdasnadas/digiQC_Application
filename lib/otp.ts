import pool from '@/lib/db';
import crypto from 'crypto';

let isTableInitialized = false;

export async function ensureOtpTable() {
    if (isTableInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.otp_verifications (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                email text NOT NULL,
                otp_code text NOT NULL,
                expires_at timestamptz NOT NULL,
                used boolean DEFAULT false,
                created_at timestamptz DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS otp_verifications_email_idx ON public.otp_verifications (email);
        `);
        isTableInitialized = true;
    } catch (err) {
        console.error('Error ensuring OTP table:', err);
    }
}

/**
 * Generate a random 6-digit numeric OTP code and store it with 10 min expiration.
 */
export async function generateAndSaveOtp(email: string): Promise<string> {
    await ensureOtpTable();
    const normalizedEmail = email.toLowerCase().trim();

    // 6-digit OTP using crypto
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unused OTPs for this email
    await pool.query(
        `UPDATE public.otp_verifications SET used = true WHERE email = $1 AND used = false`,
        [normalizedEmail]
    );

    // Insert new OTP
    await pool.query(
        `INSERT INTO public.otp_verifications (email, otp_code, expires_at, used)
         VALUES ($1, $2, $3, false)`,
        [normalizedEmail, otp, expiresAt]
    );

    return otp;
}

/**
 * Verify if the provided OTP is valid, unused, and not expired.
 */
export async function verifyOtpCode(email: string, code: string): Promise<boolean> {
    await ensureOtpTable();
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedCode = code.trim();

    const { rows } = await pool.query(
        `SELECT id FROM public.otp_verifications
         WHERE email = $1 AND otp_code = $2 AND used = false AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalizedEmail, trimmedCode]
    );

    if (rows.length === 0) {
        return false;
    }

    // Mark as used
    await pool.query(
        `UPDATE public.otp_verifications SET used = true WHERE id = $1`,
        [rows[0].id]
    );

    return true;
}
