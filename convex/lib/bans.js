export async function isBanned(ctx, ipHash) {
	const ban = await ctx.db
		.query('bannedIps')
		.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
		.unique();
	return ban !== null;
}
