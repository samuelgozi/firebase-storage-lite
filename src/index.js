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
 *
 * Additional note: It seems like the firebase storage API is closer to
 * the "android over the air" API than GCP's API uploads:
 * https://developers.google.com/android/over-the-air/v1/how-tos/create-package
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
 * Encapsulates logic for managing uploading tasks.
 * @param {Reference} reference
 * @param {Blob} blob
 * @param {Object} [metadata]
 */
class UploadTask {
	constructor({ bucket, name, blob, metadata = {} }) {
		// Trying to emulate a promise by extending one.
		// Doing it "manually" because extending it by using the
		// native class 'extend' is not polyfillable.
		this._promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
		this.then = this.promise.then.bind(this._promise);
		this.catch = this.promise.catch.bind(this._promise);

		// Save all the needed info.
		this.blob = blob;
		this.metadata = {
			...metadata,
			name,
			contentType: blob.type
		};
		this.baseURL = `${baseApiURL}b/${bucket}/o`;
	}

	async start() {
		// If the file is smaller than 5MB, use a simple(non-resumable) upload.
		// https://cloud.google.com/storage/docs/json_api/v1/how-tos/upload
		if (this.blob.size < 5000000) {
			return this.simpleUpload();
		}

		// Else perform a resumable upload.
		// More info about resumable uploads can be found here:
		// https://developers.google.com/android/over-the-air/v1/how-tos/create-package
		// This has nothing to do with firebase, but it seems like its the same protocol.

		// Request to start a resumable upload session,
		// the response will contain headers with information
		// on how to proceed on subsequent requests.
		const resumableSessionHeaders = await fetch(this.baseURL + objectToQuery({ name }), {
			method: 'POST',
			body: JSON.stringify(this.metadata),
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'X-Goog-Upload-Protocol': 'resumable',
				'X-Goog-Upload-Command': 'start',
				'X-Goog-Upload-Header-Content-Length': this.blob.size,
				'X-Goog-Upload-Header-Content-Type': this.blob.type
			}
		})
			.then(res => res.headers) // TODO: Check if the response was "ok".
			.catch(this._reject);

		// Save the info needed to resume the upload to the instance.
		this.uploadURL = resumableSessionHeaders.get('x-goog-upload-url');
		// TODO: what to do when no granularity was requested?
		this.granularity = resumableSessionHeaders.get('x-goog-upload-chunk-granularity');
		this.offset = 0;

		return this.resumeUpload();
	}

	/**
	 * Resume the upload from the instance's offset.
	 */
	resumeUpload() {
		const { uploadURL, granularity, offset, blob } = this;
		const remainingBlob = blob.slice(offset, granularity);
		const isLastRequest = remainingBlob.size < granularity;
		const request = new Request(uploadURL, {
			method: 'POST',
			headers: {
				'X-Goog-Upload-Offset': offset,
				'X-Goog-Upload-Command': isLastRequest ? 'upload, finalize' : 'upload'
			},
			body: remainingBlob
		});

		return fetch(request)
			.then(response => {
				if (response.headers.get('x-goog-upload-status') === 'final') {
					this._resolve(response.json());
				}

				this.offset += granularity;
				this.resumeUpload();
			})
			.catch(this._reject);
	}

	/**
	 * If the file is small enough, a non-resumable multipart upload
	 * will be done, this function handles that.
	 */
	async simpleUpload() {
		/*
		 * As a work around for manually building a multipart
		 * request, I use the FormData object. However, it still
		 * not exactly what we need, it sends the request as "multipart/form-data"
		 * and what we need is "multipart/related", in addition, we need to add
		 * a custom header to the metadata part as specified here:
		 * https://developers.google.com/android/over-the-air/v1/how-tos/create-package#multipart
		 *
		 * In order to add the metadata with the correct headers, we use a Blob
		 * instead of just passing a string, and we set the correct type in the
		 * blob `options` argument.
		 *
		 * Later we add the file we want to upload just as we would regularly
		 * with FormData objects.
		 *
		 * And lastly we try to overwrite the request headers to "multipart/related."
		 */
		const formData = new FormData();
		const metadata = new Blob([JSON.stringify(this.metadata)], { type: 'application/json; charset=UTF-8' });

		formData.append('', metadata);
		formData.append('', this.blob);

		const request = new Request(`${this.baseURL}${encodeURIComponent(this.metadata.name)}`, {
			method: 'POST',
			body: formData
		});

		request.headers.set('Content-Type', request.headers.get('Content-Type').replace('form-data', 'related'));
		request.headers.set('X-Goog-Upload-Protocol', 'multipart');

		return fetch(request)
			.then(this._resolve)
			.catch(this._reject);
	}
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
		return this.objectPath === '' || this.objectPath === undefined;
	}

	/**
	 * Returns a "gs://" formatted path.
	 */
	get gsPath() {
		return `gs://${this.bucket}/${this.objectPath}`;
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
	put(blob, metadata) {
		return new UploadTask(this, blob, metadata);
	}

	/**
	 * Deletes the object.
	 */
	delete() {
		return fetch(baseApiURL + this.URIPath, { method: 'DELETE' });
	}

	/**
	 * Lists objects in this reference.
	 */
	list() {
		const query = objectToQuery({ prefix: this.objectPath, delimiter: '/' });
		return fetch(`${baseApiURL}b/${this.bucket}/o${query}`);
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
