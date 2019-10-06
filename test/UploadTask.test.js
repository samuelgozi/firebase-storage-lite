const UploadTask = require('../src/UploadTask').default;
const { MockBlob, mockResumableResponses } = require('./tests-helpers');

describe('UploadTask', () => {
	describe('Start', () => {
		beforeEach(() => {
			fetch.resetMocks();
		});

		test('Uploads using "simple upload" for files smaller than 5MB', async () => {
			// Mock the fetch response.
			fetch.mockResponse(JSON.stringify({ all: 'good' }));

			const mockBlob = new MockBlob(4999999, 'some type');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Run the start function.
			await uploadTask.start();

			// Get the request object made by fetch.
			const request = new Request(...fetch.mock.calls[0]);

			expect(request.headers.get('X-Goog-Upload-Protocol')).toEqual('multipart');
		});

		test('Uploads using "resumable upload" for files larger than 5MB', async () => {
			const mockBlob = new MockBlob(5000001, 'someType');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Mock all fetch responses for the resumable upload requests
			mockResumableResponses(mockBlob);

			// Run the start function.
			await uploadTask.start();

			// Get the request object made by fetch.
			const request = new Request(...fetch.mock.calls[0]);

			expect(request.headers.get('X-Goog-Upload-Protocol')).toEqual('resumable');
		});
	});

	describe('Resumable upload', () => {
		beforeEach(() => {
			fetch.resetMocks();
		});

		test('Requests resumable session with correct headers', async () => {
			const mockBlob = new MockBlob(5000000, 'someType');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Mock all fetch responses for the resumable upload requests.
			mockResumableResponses(mockBlob);

			// Run the start function.
			await uploadTask.start();

			// Get the request object made by fetch.
			const request = new Request(...fetch.mock.calls[0]);
			const headers = request.headers;

			expect(headers.get('Content-type')).toEqual('application/json; charset=utf-8');
			expect(headers.get('X-Goog-Upload-Protocol')).toEqual('resumable');
			expect(headers.get('X-Goog-Upload-Command')).toEqual('start');
			expect(headers.get('X-Goog-Upload-Header-Content-Length')).toEqual(String(mockBlob.size));
			expect(headers.get('X-Goog-Upload-Header-Content-Type')).toEqual(mockBlob.type);
		});

		test('Uploads chunks with the right granularity', async () => {
			const mockBlob = new MockBlob(5000000, 'someType');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Mock all fetch responses for the resumable upload requests.
			mockResumableResponses(mockBlob);

			// Run the start function.
			await uploadTask.start();

			const expectedRequests = Math.ceil(mockBlob.size / 262144) + 1;
			expect(fetch.mock.calls.length).toEqual(expectedRequests);
		});

		test('Requests are made with the right headers', async () => {
			const mockBlob = new MockBlob(5000000, 'someType');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Mock all fetch responses for the resumable upload requests.
			// And save the list of the expected headers for all requests.
			const expectedRequestsHeaders = mockResumableResponses(mockBlob);

			// Run the start function.
			await uploadTask.start();

			// Loop through all the requests and make sure they stick to
			// the requested granularity.
			for (let i = 0; i < fetch.mock.calls.length; i++) {
				if (i === 0) continue; // Skip over the first request

				const request = new Request(...fetch.mock.calls[i]);
				const expectedOffset = expectedRequestsHeaders[i]['X-Goog-Upload-Offset'];
				const expectedCommand = expectedRequestsHeaders[i]['X-Goog-Upload-Command'];
				expect(request.headers.get('X-Goog-Upload-Offset')).toEqual(expectedOffset);
				expect(request.headers.get('X-Goog-Upload-Command')).toEqual(expectedCommand);
			}
		});
	});
});
