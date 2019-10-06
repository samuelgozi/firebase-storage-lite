const { objectToQuery } = require('../src/utils.js');

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
