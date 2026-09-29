import { TwitterApi } from "twitter-api-v2";
import { loadConfig, type XClient, type XPost } from "@lens/core";

export function createLiveXClient(): XClient {
  const config = loadConfig();
  if (!config.xApiKey || !config.xApiSecret || !config.xAccessToken || !config.xAccessSecret) {
    throw new Error(
      "X_MODE=live requires X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_SECRET",
    );
  }
  const client = new TwitterApi({
    appKey: config.xApiKey,
    appSecret: config.xApiSecret,
    accessToken: config.xAccessToken,
    accessSecret: config.xAccessSecret,
  });

  return {
    async listMentions(sinceId) {
      const userId = config.xBotUserId ?? (await client.v2.me()).data.id;
      const timeline = await client.v2.userMentionTimeline(userId, {
        since_id: sinceId,
        max_results: 10,
        "tweet.fields": ["author_id", "created_at", "referenced_tweets", "text"],
        expansions: ["author_id", "referenced_tweets.id"],
        "user.fields": ["username"],
      });
      const users = new Map((timeline.includes?.users ?? []).map((user) => [user.id, user.username]));
      return (timeline.tweets ?? []).map((tweet) => toPost(tweet, users));
    },
    async getPost(id) {
      const tweet = await client.v2.singleTweet(id, {
        "tweet.fields": ["author_id", "created_at", "text", "referenced_tweets"],
        expansions: ["author_id"],
        "user.fields": ["username"],
      });
      const users = new Map((tweet.includes?.users ?? []).map((user) => [user.id, user.username]));
      return toPost(tweet.data, users);
    },
    async reply({ inReplyToId, text }) {
      const result = await client.v2.reply(text, inReplyToId);
      return { id: result.data.id };
    },
    async post(text) {
      const result = await client.v2.tweet(text);
      return { id: result.data.id };
    },
  };
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
