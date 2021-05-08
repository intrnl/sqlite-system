let base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generate_random (size = 16, charset = base62) {
	let len = charset.length;
	let str = '';

	while (size--) str += charset[(Math.random() * len) | 0];

	return str;
}

export function create_deferred<T = any> (): Deferred<T> {
	let deferred = {} as any;

	deferred.promise = new Promise((resolve, reject) => (
		Object.assign(deferred, { resolve, reject })
	));

	return deferred as Deferred<T>;
}

export interface Deferred<T> {
	promise: Promise<T>;
	resolve (value: T): void;
	reject (reason?: any): void;
}
