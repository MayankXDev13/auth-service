import type { EmailPort } from '../ports';
import logger from '../../../logger/winston.logger';
import { Resend } from 'resend';

export class ResendEmailAdapter implements EmailPort {
  private resend: Resend;
  private from: string;

  constructor(opts: { apiKey: string; from: string }) {
    if (!opts.apiKey) throw new Error('RESEND_API_KEY is required');
    if (!opts.from) throw new Error('RESEND_FROM_EMAIL is required');
    this.resend = new Resend(opts.apiKey);
    this.from = opts.from;
  }

  async send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }> {
    const attempt = async (retries = 2): Promise<{ id: string }> => {
      const response = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });

      if (response.error) {
        logger.error('Failed to send email', { to: opts.to, subject: opts.subject, error: response.error });
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 200 * (3 - retries)));
          return attempt(retries - 1);
        }
        throw new Error(`Email delivery failed: ${response.error.message}`);
      }

      logger.info('Email sent successfully', { to: opts.to, subject: opts.subject, messageId: response.data?.id });
      return { id: response.data?.id || 'resend-unknown' };
    };

    return attempt();
  }
}
