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
const gsRegex = /gs:\/\/([\w-.]+)\/?(.+)?/i;
const httpRegex = /https?:\/\/firebasestorage\.googleapis\.com\/v\w+\/b\/([\w-.]+)\/o\/?([^?#]+)?/i;
const baseApiURL = 'https://firebasestorage.googleapis.com/v0/';

/**
 * Converts an Object to a URI query String.
 * @param {Object} obj
 * @returns {string}
 */
function objectToQuery(obj) {
	let propsArr = [];

	for (let prop in obj) {
		if (obj[prop] === undefined) continue; // Skip over undefined props.
		propsArr.push(`${prop}=${encodeURIComponent(obj[prop])}`);
	}

	return `?${propsArr.join('&')}`;
}

/**
 * Encapsulates logic for handling objects in cloud storage for firebase.
 * @param {string} path A http or gs path to an object or a directory.
 */
class Reference {
	constructor(path) {
		// If the path is the name of a firebase default bucket.
		// All firebase default buckets end with '.appspot.com'.
		if (path.endsWith('.appspot.com')) {
			this.bucket = path;
			this.objectPath = '';
			return;
		}

		const isGSPath = path.startsWith('gs://');
		const regex = isGSPath ? gsRegex : httpRegex;
		const [, bucket, objectPath] = regex.exec(path);

		this.bucket = bucket;
		// Object names can contain characters that require encoding/decoding.
		// but are encoded only when when passed in URIs.
		this.objectPath = isGSPath ? objectPath || '' : decodeURIComponent(objectPath || '');
	}

	/**
	 * Returns true if the reference is the root of the bucket.
	 */
	get isRoot() {
		return objectPath === '' || objectPath === undefined;
	}

	/**
	 * Returns a "gs://" formatted path.
	 */
	get gsPath() {
		return `gs://${bucket}/${objectPath}`;
	}

	/**
	 * Returns reference instance for the parent folder
	 * of this instance's reference.
	 */
	get parent() {
		return new Reference(this.gsPath.replace(/([^/]+)\/?$/, ''));
	}

	/**
	 * Returns a reference instance for the
	 * root of the bucket.
	 */
	get root() {
		if (this.isRoot) return this;
		return new Reference(`gs://${this.bucket}/`);
	}

	/**
	 * Get the segments representing the object
	 * for use by the API in the http request.
	 */
	get URIPath() {
		return `/b/${this.bucket}/o/${encodeURIComponent(this.objectPath)}`;
	}

	/**
	 * Returns a new reference for a child of this
	 * reference with the new path.
	 */
	child(path) {
		const childPath = this.gsPath.replace(/\/?$/, path);
		return new Reference(childPath);
	}

	/**
	 * Uploads a blob or a string.
	 */
	put(blob) {}

	/**
	 * Deletes the object.
	 */
	delete() {
		return fetch(baseApiURL + this.URIPath, { method: 'PATCH' });
	}

	/**
	 * Lists objects in this reference.
	 */
	list() {
		const query = objectToQuery({ prefix: this.objectPath, delimiter: '/' });
		return fetch(`${baseApiURL}/b/${this.bucket}/o${query}`);
	}

	/**
	 * Returns the metadata for the object.
	 */
	getMetadata() {
		return fetch(baseApiURL + this.URIPath);
	}

	/**
	 * Updates the metadata of an object.
	 */
	updateMetadata(newMetadata) {
		return fetch(baseApiURL + this.URIPath, {
			method: 'PATCH',
			body: JSON.stringify(newMetadata)
		});
	}

	/**
	 * Returns a download link.
	 */
	async getDownloadURL() {
		const data = await this.getMetadata();
		const token = data.downloadTokens.split(',')[0];
		const query = objectToQuery({ alt: 'media', token });
		return baseApiURL + this.URIPath + query;
	}
}
