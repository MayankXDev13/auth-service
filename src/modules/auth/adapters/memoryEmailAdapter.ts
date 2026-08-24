import type { EmailPort } from '../ports';

export type SentEmail = { to: string; subject: string; html: string; text: string };

export class InMemoryEmailAdapter implements EmailPort {
  sent: SentEmail[] = [];

  async send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }> {
    this.sent.push({ to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    return { id: `mem-${this.sent.length}` };
  }

  clear() {
    this.sent = [];
  }
}
