import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword } from '@/lib/auth';
import { generateAndSaveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Credentials are valid, now generate 6-digit OTP
        const otp = await generateAndSaveOtp(user.email);

        // Send OTP via SMTP to the user's email
        try {
            await sendOtpEmail(user.email, otp, user.name);
        } catch (mailError) {
            console.error('Failed to send OTP email:', mailError);
            return NextResponse.json(
                { error: 'Failed to send OTP email: ' + ((mailError as Error).message || 'SMTP error') },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            requireOtp: true,
            email: user.email,
            message: `A 6-digit verification code has been sent to ${user.email}`,
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
