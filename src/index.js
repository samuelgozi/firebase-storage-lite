/**
 * It seems like the firebase storage API is closer to
 * the "android over the air" API than GCP's API,
 * A lot of  helpful info about it can be found here:
 * https://developers.google.com/android/over-the-air/v1/how-tos/create-package
 */
import { gsRegex, httpRegex, baseApiURL, objectToQuery, authorizedFetch } from './utils.js';
import UploadTask from './UploadTask.js';

/**
 * Encapsulates logic for handling objects in cloud storage for firebase.
 * @param {string} path Http, GS or a appspot.com path to a file or a bucket
 */
export default class Reference {
	constructor(path, auth) {
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
		this.auth = auth;

		// Helper that wraps native fetch and adds auth headers.
		this.fetch = authorizedFetch;
	}

	/**
	 * Returns true if the reference is the root of the bucket.
	 * @returns {boolean}
	 */
	get isRoot() {
		return this.objectPath === '' || this.objectPath === undefined;
	}

	/**
	 * Returns a "gs://" formatted path.
	 * @returns {string}
	 */
	get gsPath() {
		return `gs://${this.bucket}/${this.objectPath}`;
	}

	/**
	 * Returns reference instance for the parent folder
	 * of this instance's reference.
	 * @returns {Reference} A reference to the parent folder of this reference.
	 */
	get parent() {
		if (this.isRoot) throw Error("Can't get parent of root");
		return new Reference(this.gsPath.replace(/([^/]+)\/?$/, ''));
	}

	/**
	 * Returns a reference instance for the
	 * root of the bucket.
	 * @returns {Reference} Reference to the root location of the bucket.
	 */
	get root() {
		if (this.isRoot) return this;
		return new Reference(`gs://${this.bucket}/`);
	}

	/**
	 * Get the segments representing the object
	 * for use by the API in the http request.
	 * @returns {string} Segment used to create internal URL to the API.
	 */
	get URIPath() {
		if (this.isRoot) throw Error("Can't get URI path for root");
		return `/b/${this.bucket}/o/${encodeURIComponent(this.objectPath)}`;
	}

	/**
	 * Returns a new reference for a child of this
	 * reference with the new path.
	 * @param {string} path Path relative to the current reference.
	 * @returns {Reference} A new reference pointing to the child.
	 */
	child(path) {
		// If doesn't start with a forward slash, add one.
		path = path.startsWith('/') ? path : '/' + path;
		// Join the provided path to the current gsPath, but make
		// sure there are no double forward slashes.
		const childPath = this.gsPath.replace(/\/?$/, path);
		return new Reference(childPath);
	}

	/**
	 * Uploads a blob to the referenced location.
	 * @param {Blob} blob The file to upload
	 * @param {Object} metadata Custom metadata for the file
	 * @returns {Promise} A promise that resolves to the full object metadata.
	 */
	put(blob, metadata) {
		return new UploadTask({ bucket: this.bucket, name: this.objectPath, blob, metadata, auth: this.auth });
	}

	/**
	 * Deletes the referenced object.
	 */
	delete() {
		return this.fetch(baseApiURL + this.URIPath, { method: 'DELETE' });
	}

	/**
	 * Lists objects prefixed with this reference's name.
	 */
	list() {
		const query = objectToQuery({ prefix: this.objectPath, delimiter: '/' });
		return this.fetch(`${baseApiURL}b/${this.bucket}/o${query}`);
	}

	/**
	 * Returns the metadata for the object.
	 * @returns {Object} the raw metadata of the referenced object.
	 */
	getMetadata() {
		return this.fetch(baseApiURL + this.URIPath).then(res => res.json());
	}

	/**
	 * Updates the metadata of an object.
	 * Provided props will be overwritten, the rest will remain untouched.
	 * @returns {Object} Updated metadata for this reference.
	 */
	updateMetadata(newMetadata) {
		return this.fetch(baseApiURL + this.URIPath, {
			method: 'PATCH',
			body: JSON.stringify(newMetadata)
		});
	}

	/**
	 * Returns a download link.
	 * @returns {string} URL that can be used to download the reference.
	 */
	async getDownloadURL() {
		const data = await this.getMetadata();
		const token = data.downloadTokens.split(',')[0];
		const query = objectToQuery({ alt: 'media', token });
		return baseApiURL + this.URIPath + query;
	}
}
