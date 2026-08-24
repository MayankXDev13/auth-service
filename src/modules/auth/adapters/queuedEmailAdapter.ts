import type { EmailPort } from '../ports';
import { enqueueEmail } from '../../email/queue';
import { ResendEmailAdapter } from './resendEmailAdapter';

/**
 * Ports & Adapters for email — queued path hides BullMQ, sync path falls back to direct Resend.
 * New AuthDomain uses this adapter when REDIS_URL is configured: `await email.send()` enqueues (non-blocking)
 * instead of `await resend.emails.send()` blocking HTTP (previous controllers did sync await).
 * Tests inject InMemoryEmailAdapter directly (no Redis), so queue is bypassed.
 */
export class QueuedEmailAdapter implements EmailPort {
  private direct: ResendEmailAdapter;

  constructor(opts: { apiKey: string; from: string }) {
    this.direct = new ResendEmailAdapter(opts);
  }

  async send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }> {
    const enqueued = await enqueueEmail({ to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }).catch(() => null);
    if (enqueued?.id) {
      return enqueued;
    }
    // fallback: direct send (no Redis or enqueue failed)
    return this.direct.send(opts);
  }
}
