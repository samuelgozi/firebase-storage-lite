/**
 * These regexp are based on the naming conventions and rules here:
 * https://cloud.google.com/storage/docs/naming
 *
 * They will match up to two groups, the first is the bucket name,
 * and the second will be the object name or undefined.
 *
 * Names for buckets are easy, they can be matched with: ([\w-.]+)
 * and they can not include characters that require encoding in a URI.
 *
 * However names for objects can have almost any character, and when used
 * in a URI scheme some of them should be encoded.
 * More info about that here:
 * https://cloud.google.com/storage/docs/json_api/
 * https://tools.ietf.org/html/rfc3986#section-3.3
 */
export const gsRegex = /gs:\/\/([\w-.]+)\/?(.+)?/i;
export const httpRegex = /https?:\/\/firebasestorage\.googleapis\.com\/v\w+\/b\/([\w-.]+)\/?(?:o\/?([^?#]+)?)?/i;
export const baseApiURL = 'https://firebasestorage.googleapis.com/v0/';

/**
 * Converts an Object to a URI query String.
 * @param {Object} obj
 * @returns {string}
 */
export function objectToQuery(obj = {}) {
	let propsArr = [];

	for (let prop in obj) {
		if (obj[prop] === undefined) continue; // Skip over undefined props.
		propsArr.push(`${prop}=${encodeURIComponent(obj[prop])}`);
	}

	return propsArr.length === 0 ? '' : `?${propsArr.join('&')}`;
}

/**
 * Uses native fetch, but adds authorization headers
 * if the Reference was instantiated with an auth instance.
 * The API is exactly the same as native fetch.
 * @param {Request|Object|string} resource the resource to send the request to, or an options object.
 * @param {Object} init an options object.
 */
export function authorizedFetch(resource, init) {
	const request = resource instanceof Request ? resource : new Request(resource, init);

	if (this.auth && this.auth.authorizeRequest) {
		this.auth.authorizeRequest(request);
	}

	return fetch(request);
}
