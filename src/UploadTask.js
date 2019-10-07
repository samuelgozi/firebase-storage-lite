import { baseApiURL, objectToQuery, authorizedFetch } from './utils.js';

/**
 * Encapsulates logic for managing uploading tasks.
 * @param {Object} options Options object
 * @param {string} options.bucket The name of the bucket
 * @param {string} options.name The full name of the object
 * @param {Blob} options.blob A blob that will be the file
 * @param {Object} [options.metadata] Custom metadata
 * @param {Object} [auth] firebase-auth-lite instance
 */
export default class UploadTask {
	constructor({ bucket, name, blob, metadata = {}, auth }) {
		this.blob = blob;
		this.metadata = {
			...metadata,
			name: name.replace(/^\//, ''),
			contentType: blob.type
		};
		this.baseURL = `${baseApiURL}b/${bucket}/o`;
		this.auth = auth;

		// Helper that wraps native fetch and adds auth headers.
		this.fetch = authorizedFetch;
	}

	/**
	 * Starts the uploading task.
	 * Returns a promise that resolves when the upload is done.
	 * @returns {Promise}
	 */
	async start() {
		// If the file is smaller than 5MB, use a simple(non-resumable) upload.
		// https://cloud.google.com/storage/docs/json_api/v1/how-tos/upload
		if (this.blob.size < 5000000) {
			return this.simpleUpload();
		}

		// Else start a resumable upload
		return this.startResumableUpload();
	}

	async startResumableUpload() {
		const { metadata, blob } = this;
		// More info about resumable uploads can be found here:
		// https://developers.google.com/android/over-the-air/v1/how-tos/create-package
		// This has nothing to do with firebase, but it seems like its the same protocol.

		// Request to start a resumable upload session,
		// the response will contain headers with information
		// on how to proceed on subsequent requests.
		// TODO: Check if the response was "ok".
		const resumableSessionHeaders = await this.fetch(this.baseURL + objectToQuery({ name: metadata.name }), {
			method: 'POST',
			body: JSON.stringify(metadata),
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'X-Goog-Upload-Protocol': 'resumable',
				'X-Goog-Upload-Command': 'start',
				'X-Goog-Upload-Header-Content-Length': blob.size,
				'X-Goog-Upload-Header-Content-Type': blob.type
			}
		}).then(res => res.headers);

		// Save the info needed to resume the upload to the instance.
		this.uploadURL = resumableSessionHeaders.get('x-goog-upload-url');
		// TODO: what to do when no granularity was requested?
		this.granularity = Number(resumableSessionHeaders.get('x-goog-upload-chunk-granularity'));
		this.offset = 0;

		return this.resumeUpload();
	}

	/**
	 * Resume the upload from the instance's offset.
	 */
	resumeUpload() {
		const { uploadURL, granularity, offset, blob } = this;
		const currentChunk = blob.slice(offset, offset + granularity);
		const isLastChunk = currentChunk.size < granularity;
		const request = new Request(uploadURL, {
			method: 'POST',
			headers: {
				'X-Goog-Upload-Offset': offset,
				'X-Goog-Upload-Command': isLastChunk ? 'upload, finalize' : 'upload'
			},
			body: currentChunk
		});

		return this.fetch(request).then(async response => {
			if (!response.ok) {
				throw await response.text();
			}

			if (response.headers.get('x-goog-upload-status') === 'final') {
				return await response.json();
			}

			this.offset += currentChunk.size;
			return this.resumeUpload();
		});
	}

	/**
	 * If the file is small enough, a non-resumable multipart upload
	 * will be done, this function handles that.
	 */
	async simpleUpload() {
		const { baseURL, metadata, blob } = this;
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
		const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });

		formData.append('', metadataBlob);
		formData.append('', blob);

		const request = new Request(baseURL + objectToQuery({ name: metadata.name }), {
			method: 'POST',
			body: formData
		});

		request.headers.set('Content-Type', request.headers.get('Content-Type').replace('form-data', 'related'));
		request.headers.set('X-Goog-Upload-Protocol', 'multipart');

		return this.fetch(request).then(async response => {
			if (!response.ok) {
				throw await response.text();
			}

			return await response.json();
		});
	}
}
