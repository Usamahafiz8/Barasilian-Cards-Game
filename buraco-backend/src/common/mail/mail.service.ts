import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('smtp.host'),
      port: this.config.get<number>('smtp.port') ?? 587,
      secure: (this.config.get<number>('smtp.port') ?? 587) === 465,
      auth: {
        user: this.config.get<string>('smtp.user'),
        pass: this.config.get<string>('smtp.pass'),
      },
    });
  }

  async sendPasswordReset(email: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Buraco Game" <${this.config.get<string>('smtp.user')}>`,
        to: email,
        subject: 'Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2>Password Reset</h2>
            <p>Use the code below to reset your password. It expires in 10 minutes.</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center;
                        padding: 16px; background: #f4f4f4; border-radius: 8px; margin: 24px 0;">
              ${otp}
            </div>
            <p>If you did not request a password reset, please ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }

  async sendWelcome(email: string, username: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Buraco Game" <${this.config.get<string>('smtp.user')}>`,
        to: email,
        subject: 'Welcome to Buraco!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2>Welcome, ${username}!</h2>
            <p>Your account has been created successfully. Get ready to play Buraco!</p>
            <p>Jump in and start your first game today.</p>
            <p>Good luck!</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${email}`, err);
    }
  }
}
