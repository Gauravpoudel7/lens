export interface XPost {
  id: string;
  authorId: string;
  authorUsername: string;
  text: string;
  parentId: string | null;
  createdAt: string;
}

export interface XClient {
  listMentions(sinceId?: string): Promise<XPost[]>;
  getPost(id: string): Promise<XPost | null>;
  reply(input: { inReplyToId: string; text: string }): Promise<{ id: string }>;
  post(text: string): Promise<{ id: string }>;
  sendDm(input: { recipientId: string; text: string }): Promise<{ id: string }>;
}
