const UploadTask = require('../src/UploadTask').default;
const Reference = require('../src/index').default;
const { MockBlob, mockResumableResponses } = require('./tests-helpers');

const ref = new Reference('gs://sandbox/some/object/path');

beforeEach(() => {
	fetch.resetMocks();
});

describe('UploadTask', () => {
	describe('Promise unctionality', () => {
		test('Has promise methods', () => {
			const blob = new MockBlob(200, 'someType');
			mockResumableResponses(blob);
			const task = new UploadTask(ref, blob);

			expect(typeof task.then).toEqual('function');
			expect(typeof task.catch).toEqual('function');
			expect(typeof task.finally).toEqual('function');

			return task;
		});

		test('Passes promise listeners to original promise', async () => {
			const blob = new MockBlob(200, 'someType');
			mockResumableResponses(blob);
			const task = new UploadTask(ref, blob);
			await task;

			const t = jest.fn(() => {});
			const c = jest.fn(() => {});
			const f = jest.fn(() => {});

			task._p.then = t;
			task._p.catch = c;
			task._p.finally = f;

			task.then(1, 2, 3);
			task.catch(1, 2, 3);
			task.finally(1, 2, 3);

			expect(t.mock.calls.length).toEqual(1);
			expect(c.mock.calls.length).toEqual(1);
			expect(f.mock.calls.length).toEqual(1);
		});
	});

	describe('Resumable upload', () => {
		test('Requests resumable session with correct headers', async () => {
			const blob = new MockBlob(5000000, 'someType');
			// Mock all fetch responses for the resumable upload requests.
			mockResumableResponses(blob);

			await new UploadTask(ref, blob);

			// Get the request object made by fetch.
			const headers = fetch.mock.calls[0][1].headers;

			expect(headers['Content-Type']).toEqual(
				'application/json; charset=utf-8'
			);
			expect(headers['X-Goog-Upload-Protocol']).toEqual('resumable');
			expect(headers['X-Goog-Upload-Command']).toEqual('start');
			expect(headers['X-Goog-Upload-Header-Content-Length']).toEqual(blob.size);
			expect(headers['X-Goog-Upload-Header-Content-Type']).toEqual(blob.type);
		});

		test('Uploads chunks with the right granularity', async () => {
			const blob = new MockBlob(5000000, 'someType');
			// Mock all fetch responses for the resumable upload requests.
			mockResumableResponses(blob);

			await new UploadTask(ref, blob);

			const expectedRequests = Math.ceil(blob.size / 262144) + 1;
			expect(fetch.mock.calls.length).toEqual(expectedRequests);
		});

		test('Requests are made with the right headers', async () => {
			const blob = new MockBlob(5000000, 'someType');
			// Mock all fetch responses for the resumable upload requests.
			// And save the list of the expected headers for all requests.
			const expectedHeaders = mockResumableResponses(blob);
			await new UploadTask(ref, blob);

			// Loop through all the requests and make sure they stick to
			// the requested granularity.
			for (let i = 0; i < fetch.mock.calls.length; i++) {
				if (i === 0) continue; // Skip over the first request

				const request = fetch.mock.calls[i][1];
				const expectedOffset = expectedHeaders[i]['X-Goog-Upload-Offset'];
				const expectedCommand = expectedHeaders[i]['X-Goog-Upload-Command'];
				expect(request.headers['X-Goog-Upload-Offset']).toEqual(expectedOffset);
				expect(request.headers['X-Goog-Upload-Command']).toEqual(
					expectedCommand
				);
			}
		});
	});

	describe('Async iterator', () => {
		test('Iterates over all of the requests', async () => {
			const blob = new MockBlob(5000000, 'someType');
			// Mock all fetch responses for the resumable upload requests.
			// And save the list of the expected headers for all requests.
			const expected = mockResumableResponses(blob)
				.map(v => {
					return { offset: v['X-Goog-Upload-Offset'], total: blob.size };
				})
				.slice(1);

			const allItems = [];

			for await (let p of new UploadTask(ref, blob)) {
				allItems.push(p);
			}

			expect(allItems).toEqual(expected);
		});
	});
});
