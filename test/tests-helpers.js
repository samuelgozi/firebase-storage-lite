/**
 * Mocks the required functionality to make the tests
 * work without using real Blobs.
 */
export class MockBlob {
	constructor(size, type) {
		this.size = size;
		this.type = type;
	}

	slice(start = 0, end = this.size, type = '') {
		end = end > this.size ? this.size : end;

		return new MockBlob(end - start, type);
	}
}

/**
 * Mocks a series of Responses for Resumable Uploads and
 * returns an array of the expected headers in th Requests.
 *
 * @param {Blob} blob A blob or a mock used in the upload.
 * @param {number} granularity The granularity size to use
 * @returns {Array} Array of headers that should be expected in the Requests.
 */
export function mockResumableResponses(blob, granularity = 262144) {
	fetch.once(null, {
		headers: {
			'x-goog-upload-url': 'http://google.com/uploadUrl',
			'x-goog-upload-chunk-granularity': granularity
		}
	});

	const expectedRequestsHeaders = [
		{
			'Content-Type': 'application/json; charset=utf-8',
			'X-Goog-Upload-Protocol': 'resumable',
			'X-Goog-Upload-Command': 'start',
			'X-Goog-Upload-Header-Content-Length': blob.size,
			'X-Goog-Upload-Header-Content-Type': blob.type
		}
	];

	const chunks = Math.floor(blob.size / granularity); // zero based

	for (let chunk = 0; chunk <= chunks; chunk++) {
		const offset = granularity * chunk;
		const isLastChunk = chunk === chunks;

		fetch.once('{}', {
			headers: {
				'x-goog-upload-status': isLastChunk ? 'final' : 'active'
			}
		});

		expectedRequestsHeaders.push({
			'X-Goog-Upload-Offset': String(offset),
			'X-Goog-Upload-Command': isLastChunk ? 'upload, finalize' : 'upload'
		});
	}

	return expectedRequestsHeaders;
}
