import { createHash } from 'crypto';

export function getClientIp(request) {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

export function hashIp(ip) {
	return createHash('sha256').update(ip).digest('hex');
}
