// More info about resumable uploads protocol can be found here:
// https://developers.google.com/android/over-the-air/v1/how-tos/create-package
// This has nothing to do with firebase, but it seems like its the same protocol.

import { baseApiURL, objectToQuery } from './utils.js';

/**
 * Encapsulates logic for managing uploading tasks.
 * @param {Object} options Options object
 * @param {Blob} blob A blob that will be the file
 * @param {Object} [metadata] Custom metadata
 */
export default class UploadTask {
	constructor(ref, blob, metadata = {}) {
		Object.assign(this, {
			metadata,
			ref,
			blob,
			offset: 0,
			_p: new Promise((res, rej) => {
				this._res = res;
				this._rej = rej;
			})
		});

		this.start();
	}

	then() {
		this._p.then(...arguments);
	}

	catch() {
		this._p.catch(...arguments);
	}

	finally() {
		this._p.finally(...arguments);
	}

	async start() {
		try {
			this.chunk = this.init();
			await this.chunk;

			while (true) {
				this.chunk = this.next();
				const result = await this.chunk;
				if (result.done) break;
			}
		} catch (e) {
			this._rej(e);
		}
	}

	async init() {
		const { ref, metadata, blob } = this;
		// More info about resumable uploads can be found here:
		// https://developers.google.com/android/over-the-air/v1/how-tos/create-package
		// This has nothing to do with firebase, but it seems like its the same protocol.

		// Request to start a resumable upload session,
		// the response will contain headers with information
		// on how to proceed on subsequent requests.
		// TODO: Check if the response was "ok".
		const sessionHeaders = await this.ref
			.fetch(
				`${baseApiURL}b/${ref.bucket}/o` +
					objectToQuery({ name: ref.objectPath }),
				{
					method: 'POST',
					body: JSON.stringify({
						...metadata,
						name: ref.objectPath,
						contentType: blob.type
					}),
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'X-Goog-Upload-Protocol': 'resumable',
						'X-Goog-Upload-Command': 'start',
						'X-Goog-Upload-Header-Content-Length': blob.size,
						'X-Goog-Upload-Header-Content-Type': blob.type
					}
				}
			)
			.then(async res => res.headers);

		// Save the info needed to resume the upload to the instance.
		this.uploadURL = sessionHeaders.get('x-goog-upload-url');
		this.granularity = Number(
			sessionHeaders.get('x-goog-upload-chunk-granularity')
		);

		return {
			done: false,
			value: { offset: 0, total: blob.size }
		};
	}

	async next() {
		const { uploadURL, granularity, offset, blob } = this;
		const chunk = blob.slice(offset, offset + granularity);
		const isLastChunk = chunk.size < granularity;
		const res = await this.ref.fetch(uploadURL, {
			method: 'POST',
			headers: {
				'X-Goog-Upload-Offset': offset,
				'X-Goog-Upload-Command': isLastChunk ? 'upload, finalize' : 'upload'
			},
			body: chunk
		});

		this.offset += chunk.size;

		if (isLastChunk) this._res(res.json());

		return {
			done: isLastChunk,
			value: { offset: this.offset, total: blob.size }
		};
	}

	[Symbol.asyncIterator]() {
		return {
			next: () => {
				return this.chunk;
			}
		};
	}
}
