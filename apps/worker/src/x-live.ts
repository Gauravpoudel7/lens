import { TwitterApi } from "twitter-api-v2";
import {
  OAuth2TokenManager,
  loadConfig,
  log,
  resolveBotUserId,
  type LensStore,
  compareIds,
  type XClient,
  type XDm,
  type XPost,
} from "@lens/core";
import { createPersistedOAuth2TokenStore } from "@lens/db";

const TWEET_FIELDS = ["author_id", "created_at", "text", "referenced_tweets"] as const;

export async function createLiveXClient(
  store: Pick<LensStore, "getCursor" | "setCursor">,
): Promise<XClient> {
  const config = loadConfig();
  const appClient = config.xBearerToken ? new TwitterApi(config.xBearerToken) : null;
  if (config.xAuthMode === "oauth2") {
    return oauth2Client(config, appClient, store);
  }
  return oauth1Client(config, appClient, store);
}

async function oauth1Client(
  config: ReturnType<typeof loadConfig>,
  appClient: TwitterApi | null,
  store: Pick<LensStore, "getCursor" | "setCursor">,
): Promise<XClient> {
  if (!config.xApiKey || !config.xApiSecret || !config.xAccessToken || !config.xAccessSecret) {
    throw new Error(
      "X_MODE=live with X_AUTH_MODE=oauth1 requires X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_SECRET",
    );
  }
  const client = new TwitterApi({
    appKey: config.xApiKey,
    appSecret: config.xApiSecret,
    accessToken: config.xAccessToken,
    accessSecret: config.xAccessSecret,
  });
  const user = async () => client;
  const botUserId = await resolveBotUserId({
    envUserId: config.xBotUserId,
    store,
    fetchMe: async () => (await client.v2.me()).data.id,
  });
  return methods({
    user,
    app: appClient,
    botUserId,
    refreshOnUnauthorized: null,
  });
}

async function oauth2Client(
  config: ReturnType<typeof loadConfig>,
  appClient: TwitterApi | null,
  cursorStore: Pick<LensStore, "getCursor" | "setCursor">,
): Promise<XClient> {
  if (!config.xOauth2ClientId || !config.xOauth2ClientSecret) {
    throw new Error(
      "X_MODE=live with X_AUTH_MODE=oauth2 requires X_OAUTH2_CLIENT_ID and X_OAUTH2_CLIENT_SECRET",
    );
  }
  const store = createPersistedOAuth2TokenStore();
  const saved = await store.read();
  if (!saved?.refreshToken && !config.xOauth2RefreshToken) {
    throw new Error(
      "X OAuth 2.0 needs X_OAUTH2_REFRESH_TOKEN, or a token already saved by npm run x:oauth2-login.",
    );
  }
  const manager = new OAuth2TokenManager({
    clientId: config.xOauth2ClientId,
    clientSecret: config.xOauth2ClientSecret,
    envRefreshToken: config.xOauth2RefreshToken,
    store,
  });
  log("x oauth2 user context", { bearerRead: Boolean(appClient) });
  const user = async () => new TwitterApi(await manager.getAccessToken());
  const botUserId = await resolveBotUserId({
    envUserId: config.xBotUserId,
    store: cursorStore,
    fetchMe: async () => (await (await user()).v2.me()).data.id,
  });
  return methods({
    user,
    app: appClient,
    botUserId,
    refreshOnUnauthorized: () => manager.getAccessToken(true),
  });
}

function methods(input: {
  user: () => Promise<TwitterApi>;
  app: TwitterApi | null;
  botUserId: string;
  refreshOnUnauthorized: (() => Promise<string>) | null;
}): XClient {
  const call = async <T>(fn: (client: TwitterApi) => Promise<T>): Promise<T> => {
    try {
      return await fn(await input.user());
    } catch (err) {
      if (!input.refreshOnUnauthorized || !isUnauthorized(err)) throw err;
      await input.refreshOnUnauthorized();
      return fn(await input.user());
    }
  };

  return {
    async listMentions(sinceId) {
      return call(async (client) => {
        const userId = input.botUserId;
        const timeline = await client.v2.userMentionTimeline(userId, {
          since_id: sinceId,
          max_results: 10,
          "tweet.fields": [...TWEET_FIELDS],
          expansions: ["author_id", "referenced_tweets.id"],
          "user.fields": ["username"],
        });
        const users = new Map((timeline.includes?.users ?? []).map((user) => [user.id, user.username]));
        return (timeline.tweets ?? []).map((tweet) => toPost(tweet, users));
      });
    },
    async getPost(id) {
      const read = async (client: TwitterApi) => {
        const tweet = await client.v2.singleTweet(id, {
          "tweet.fields": [...TWEET_FIELDS],
          expansions: ["author_id"],
          "user.fields": ["username"],
        });
        const users = new Map((tweet.includes?.users ?? []).map((user) => [user.id, user.username]));
        return toPost(tweet.data, users);
      };
      if (input.app) {
        try {
          return await read(input.app);
        } catch (err) {
          if (!isUnauthorized(err) && !isForbidden(err)) throw err;
        }
      }
      return call(read);
    },
    async reply({ inReplyToId, text }) {
      const result = await call((client) => client.v2.reply(text, inReplyToId));
      return { id: result.data.id };
    },
    async post(text) {
      const result = await call((client) => client.v2.tweet(text));
      return { id: result.data.id };
    },
    async listDms(sinceId) {
      // GET /2/dm_events needs dm.read. One page of the newest events is enough at a 3-minute poll.
      return call(async (client) => {
        const page = await client.v2.listDmEvents({
          event_types: "MessageCreate",
          "dm_event.fields": ["id", "text", "event_type", "created_at", "sender_id"],
          expansions: ["sender_id"],
          "user.fields": ["username"],
          max_results: 50,
        });
        const users = new Map((page.includes?.users ?? []).map((user) => [user.id, user.username]));
        const dms: XDm[] = [];
        for (const event of page.events) {
          if (event.event_type !== "MessageCreate" || !event.sender_id) continue;
          if (event.sender_id === input.botUserId) continue;
          if (sinceId && compareIds(event.id, sinceId) <= 0) continue;
          dms.push({
            id: event.id,
            senderId: event.sender_id,
            senderUsername: users.get(event.sender_id) ?? "",
            text: event.text,
            createdAt: event.created_at ?? new Date().toISOString(),
          });
        }
        return dms.sort((a, b) => compareIds(a.id, b.id));
      });
    },
    async sendDm({ recipientId, text }) {
      const result = await call((client) => client.v2.sendDmToParticipant(recipientId, { text }));
      return { id: result.dm_event_id };
    },
  };
}

function isUnauthorized(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 401;
}

function isForbidden(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 403;
}

function toPost(
  tweet: {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    referenced_tweets?: Array<{ type: string; id: string }>;
  },
  users: Map<string, string>,
): XPost {
  const authorId = tweet.author_id ?? "unknown";
  return {
    id: tweet.id,
    authorId,
    authorUsername: users.get(authorId) ?? "unknown",
    text: tweet.text,
    parentId: tweet.referenced_tweets?.find((item) => item.type === "replied_to")?.id ?? null,
    createdAt: tweet.created_at ?? new Date().toISOString(),
  };
}
