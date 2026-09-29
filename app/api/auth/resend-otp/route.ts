import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth';
import { generateAndSaveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Generate a new 6-digit OTP
        const otp = await generateAndSaveOtp(user.email);

        // Send OTP via SMTP
        try {
            await sendOtpEmail(user.email, otp, user.name);
        } catch (mailError) {
            console.error('Failed to send OTP email:', mailError);
            return NextResponse.json(
                { error: 'Failed to send OTP email. Please check SMTP settings.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'A new verification code has been sent to your email',
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
