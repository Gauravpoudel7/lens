import { newId } from "../ids.js";
import type { XClient, XPost } from "./types.js";

export class MockXClient implements XClient {
  mentions: XPost[] = [];
  posts = new Map<string, XPost>();
  replies: Array<{ id: string; inReplyToId: string; text: string }> = [];
  timeline: XPost[] = [];

  seed(post: XPost): void {
    this.posts.set(post.id, post);
    if (post.text.includes("@askLens") || post.text.includes("@AskLens")) {
      this.mentions.push(post);
    }
  }

  async listMentions(sinceId?: string): Promise<XPost[]> {
    if (!sinceId) return [...this.mentions];
    return this.mentions.filter((post) => compareIds(post.id, sinceId) > 0);
  }

  async getPost(id: string): Promise<XPost | null> {
    return this.posts.get(id) ?? null;
  }

  async reply(input: { inReplyToId: string; text: string }): Promise<{ id: string }> {
    const id = `x_${newId(12)}`;
    this.replies.push({ id, ...input });
    return { id };
  }

  async post(text: string): Promise<{ id: string }> {
    const id = `x_${newId(12)}`;
    const post: XPost = {
      id,
      authorId: "lens",
      authorUsername: "askLens",
      text,
      parentId: null,
      createdAt: new Date().toISOString(),
    };
    this.timeline.push(post);
    this.posts.set(id, post);
    return { id };
  }
}

export function compareIds(a: string, b: string): number {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    return left > right ? 1 : left < right ? -1 : 0;
  } catch {
    return a > b ? 1 : a < b ? -1 : 0;
  }
}
