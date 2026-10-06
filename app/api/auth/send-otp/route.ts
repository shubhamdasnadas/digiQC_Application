import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth';
import { generateAndSaveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';
import { ensurePublicSchemaTables } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const { email } = await request.json();

        if (!email || !String(email).trim()) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await findUserByEmail(String(email).trim());
        if (!user) {
            return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
        }

        // Generate a 6-digit OTP stored in database
        const otp = await generateAndSaveOtp(user.email);

        // Send OTP via email
        try {
            await sendOtpEmail(user.email, otp, user.name);
        } catch (mailError) {
            console.error('Failed to send OTP email:', mailError);
            return NextResponse.json(
                { error: 'Failed to send verification code email: ' + ((mailError as Error).message || 'SMTP error') },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            email: user.email,
            message: `A 6-digit verification code has been sent to ${user.email}`,
        });
    } catch (error) {
        console.error('Error in send-otp route:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
