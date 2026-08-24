import type { AnalyticsPort } from '../ports';
import { PostHog } from 'posthog-node';
import logger from '../../../logger/winston.logger';

export class PostHogAnalyticsAdapter implements AnalyticsPort {
  private client: PostHog | null = null;

  constructor(private readonly apiKey?: string) {
    if (apiKey) {
      this.client = new PostHog(apiKey, { host: 'https://us.i.posthog.com' });
    } else {
      logger.warn('POSTHOG_API_KEY not provided — analytics disabled');
    }
  }

  capture(event: { distinctId: string; event: string; properties?: Record<string, unknown> }): void {
    try {
      this.client?.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    } catch (e) {
      logger.warn('PostHog capture failed', { error: e });
    }
  }

  async flush(): Promise<void> {
    if (this.client) await this.client.flush();
  }

  async shutdown(): Promise<void> {
    if (this.client) await this.client.shutdown();
  }

  async close(): Promise<void> {
    await this.shutdown();
  }
}

export class NoopAnalyticsAdapter implements AnalyticsPort {
  capture(_event: { distinctId: string; event: string; properties?: Record<string, unknown> }): void {}
}
