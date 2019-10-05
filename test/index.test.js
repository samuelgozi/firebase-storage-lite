// import fetch from 'node-fetch';
import config from '../firebaseConfig.js';
import { objectToQuery, UploadTask, Reference } from '../src/index.js';
import { MockBlob, mockResumableResponses } from './utils.js';

describe('objectToQuery', () => {
	test('Returns an empty string when an empty object is passed', () => {
		expect(objectToQuery({})).toEqual('');
	});

	test('Returns an empty string when no nothing is passed', () => {
		expect(objectToQuery()).toEqual('');
	});

	test('Returns correct string for one argument', () => {
		expect(objectToQuery({ name: 'Samuel' })).toEqual('?name=Samuel');
	});

	test('Returns correct string for multiple argument', () => {
		expect(objectToQuery({ name: 'Samuel', address: 'somewhere' })).toEqual('?name=Samuel&address=somewhere');
		expect(objectToQuery({ name: 'Samuel', address: 'somewhere', color: 'green' })).toEqual(
			'?name=Samuel&address=somewhere&color=green'
		);
	});

	test('Skips over undefined values', () => {
		expect(objectToQuery({ name: 'Samuel', address: undefined })).toEqual('?name=Samuel');
	});

	test('Encodes characters to URI standards', () => {
		expect(objectToQuery({ path: 'such/path/much/escape?' })).toEqual('?path=such%2Fpath%2Fmuch%2Fescape%3F');
	});
});

describe('UploadTask', () => {
	describe('Constructor', () => {
		describe('Extends the promise API', () => {
			test('then', async () => {
				const uploadTask = new UploadTask('bucket', 'name', new MockBlob(5000, 'type'));
				uploadTask._resolve('expectedValue');
				const value = await uploadTask;

				expect(value).toEqual('expectedValue');
			});

			test('catch', async () => {
				const uploadTask = new UploadTask('bucket', 'name', new MockBlob(5000, 'type'));
				var catchValue;

				uploadTask._reject('expectedValue');

				await uploadTask.catch(e => {
					catchValue = e;
				});

				expect(catchValue).toEqual('expectedValue');
			});
		});
	});

	describe('The "start" method', () => {
		beforeEach(() => {
			fetch.resetMocks();
		});

		test('Uploads using "simple upload" for files smaller than 5MB', () => {
			// Mock the fetch response.
			fetch.mockResponse(JSON.stringify({ all: 'good' }));

			const mockBlob = new MockBlob(4999999, 'some type');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Run the start function.
			uploadTask.start();

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
			uploadTask.start();
			await uploadTask;

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
			// Mock the fetch response.
			fetch.mockResponse(JSON.stringify({ all: 'good' }));

			const mockBlob = new MockBlob(5000000, 'someType');
			const uploadTask = new UploadTask('bucket', 'name', mockBlob);

			// Mock all fetch responses for the resumable upload requests.
			mockResumableResponses(mockBlob);

			// Run the start function.
			uploadTask.start();
			await uploadTask;

			// Get the request object made by fetch.
			const request = new Request(...fetch.mock.calls[0]);
			const headers = request.headers;

			expect(headers.get('Content-type')).toEqual('application/json; charset=utf-8');
			expect(headers.get('X-Goog-Upload-Protocol')).toEqual('resumable');
			expect(headers.get('X-Goog-Upload-Command')).toEqual('start');
			expect(headers.get('X-Goog-Upload-Header-Content-Length')).toEqual(String(mockBlob.size));
			expect(headers.get('X-Goog-Upload-Header-Content-Type')).toEqual(mockBlob.type);
		});
	});
});
