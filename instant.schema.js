import { i } from '@instantdb/admin';

const schema = i.schema({
  entities: {
    comments: i.entity({
      url: i.string().indexed(),
      username: i.string(),
      passwordHash: i.string(),
      text: i.string(),
      ipHash: i.string().indexed(),
      depth: i.number(),
      reply: i.string().optional(),
      parentId: i.string().optional().indexed(),
      createdAt: i.date().indexed(),
      updatedAt: i.date(),
      deletedAt: i.date().optional(),
    }),
    commentVotes: i.entity({
      commentId: i.string().indexed(),
      ipHash: i.string().indexed(),
      voteType: i.string(),
      createdAt: i.date(),
    }),
    likes: i.entity({
      url: i.string().indexed(),
      ipHash: i.string().indexed(),
      createdAt: i.date(),
    }),
    bannedIps: i.entity({
      ipHash: i.string().unique().indexed(),
      reason: i.string().optional(),
      createdAt: i.date(),
    }),
    rateLimits: i.entity({
      ipHash: i.string().indexed(),
      action: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
  },
});

export default schema;
