export async function isBanned(ctx, ipHash) {
	// `.first()` (not `.unique()`): a stray duplicate ban row must never turn a
	// ban into a thrown 500 on every comment/vote/like for that IP.
	const ban = await ctx.db
		.query('bannedIps')
		.withIndex('by_ip', (q) => q.eq('ipHash', ipHash))
		.first();
	return ban !== null;
}
