import { PostHog } from 'posthog-node';
import logger from '../logger/winston.logger';

const apiKey = process.env.POSTHOG_API_KEY;

// Do not crash if POSTHOG_API_KEY missing (env schema marks optional, old code used `!` assert)
// Export as PostHog with no-op fallback to keep existing `posthog.capture` call-sites type-safe.
// New code should use domain's AnalyticsPort; legacy controllers keep `posthog.capture` working.
const dummyPosthog = { capture: () => {}, flush: async () => {}, shutdown: async () => {} } as unknown as PostHog;
export const posthog: PostHog = apiKey
  ? new PostHog(apiKey, { host: 'https://us.i.posthog.com' })
  : (() => {
      if (process.env.NODE_ENV !== 'test') logger.warn('POSTHOG_API_KEY not configured — analytics disabled');
      return dummyPosthog;
    })();

// Safe capture wrapper — callers should prefer domain's AnalyticsPort, but direct imports remain backward-compat
export const safeCapture = (props: Parameters<PostHog['capture']>[0]) => {
  try {
    // posthog may be null in test/dev without key
    (posthog as any)?.capture?.(props);
  } catch (e) {
    logger.warn('PostHog capture failed', { error: e });
  }
};
