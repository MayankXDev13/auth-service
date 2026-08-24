import Mailgen from 'mailgen';
import { Resend } from 'resend';
import logger from '../logger/winston.logger';

const mailGenerator = new Mailgen({
  theme: 'default',
  product: {
    name: 'FreeAPI',
    link: 'https://freeapi.app',
  },
});

// Lazily initialized — do not throw at import (fixes startup crash when keys missing, env.ts already validates)
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not defined in environment variables');
  _resend = new Resend(apiKey);
  return _resend;
}

const sendEmail = async (options: {
  email: string;
  subject: string;
  mailgenContent: Mailgen.Content;
}) => {
  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  // Validate required env at call-time, not import-time
  if (!process.env.RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL is not defined in environment variables');

  try {
    const response = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: options.email,
      subject: options.subject,
      html: emailHtml,
      text: emailTextual,
    });

    if (response.error) {
      logger.error('Failed to send email', {
        to: options.email,
        subject: options.subject,
        error: response.error,
      });
      throw new Error(`Email delivery failed: ${response.error.message}`);
    }

    logger.info('Email sent successfully', {
      to: options.email,
      subject: options.subject,
      messageId: response.data?.id,
    });

    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Failed to send email (exception)', {
      to: options.email,
      subject: options.subject,
      error: error instanceof Error ? error.message : error,
    });

    throw new Error(
      `Email delivery failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};

// Re-export canonical templates (single source)
export { emailVerificationMailgenContent, forgotPasswordMailgenContent } from './mailTemplates';

export { sendEmail };
