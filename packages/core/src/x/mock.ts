import { newId } from "../ids.js";
import type { XClient, XDm, XPost } from "./types.js";

export class MockXClient implements XClient {
  mentions: XPost[] = [];
  posts = new Map<string, XPost>();
  replies: Array<{ id: string; inReplyToId: string; text: string }> = [];
  dms: Array<{ id: string; recipientId: string; text: string }> = [];
  timeline: XPost[] = [];
  inbox: XDm[] = [];
  dmReads = 0;

  seed(post: XPost): void {
    this.posts.set(post.id, post);
    if (post.text.toLowerCase().includes("@justasklens")) {
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
      authorUsername: "justasklens",
      text,
      parentId: null,
      createdAt: new Date().toISOString(),
    };
    this.timeline.push(post);
    this.posts.set(id, post);
    return { id };
  }

  async listDms(sinceId?: string): Promise<XDm[]> {
    this.dmReads += 1;
    return this.inbox
      .filter((dm) => !sinceId || compareIds(dm.id, sinceId) > 0)
      .sort((a, b) => compareIds(a.id, b.id));
  }

  async sendDm(input: { recipientId: string; text: string }): Promise<{ id: string }> {
    const id = `dm_${newId(12)}`;
    this.dms.push({ id, ...input });
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
