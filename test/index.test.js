const Reference = require('../src/index').default;

describe('Reference', () => {
	describe('constructor', () => {
		test('Creates reference to bucket when "*.appspot.com" is passed', () => {
			const ref = new Reference('sandbox.appspot.com');

			expect(ref.bucket).toEqual('sandbox.appspot.com');
			expect(ref.objectPath).toEqual('');
		});

		describe('gs://* paths', () => {
			test('Extracts the bucket when path point to root', () => {
				const ref = new Reference('gs://sandbox/');
				const refNoSlash = new Reference('gs://sandbox');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('');
				expect(refNoSlash.bucket).toEqual('sandbox');
				expect(refNoSlash.objectPath).toEqual('');
			});

			test('Extracts the bucket and the object', () => {
				const ref = new Reference('gs://sandbox/some/object/path');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('some/object/path');
			});

			test('Does not remove forward slashes', () => {
				const ref = new Reference('gs://sandbox/some/object/path/');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('some/object/path/');
			});
		});

		describe('https://firebasestorage.googleapis.com/* paths', () => {
			test('Extracts the bucket when path point to root', () => {
				const ref = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/');
				const refNoSlash = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('');
				expect(refNoSlash.bucket).toEqual('sandbox');
				expect(refNoSlash.objectPath).toEqual('');
			});

			test('Extracts the bucket when path point to root and has ? or # params', () => {
				const refQuestion = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/?something');
				const refHash = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/#something');
				const refNoSlashQuestion = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox?something');
				const refNoSlashHash = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox#something');

				expect(refQuestion.bucket).toEqual('sandbox');
				expect(refQuestion.objectPath).toEqual('');
				expect(refHash.bucket).toEqual('sandbox');
				expect(refHash.objectPath).toEqual('');
				expect(refNoSlashQuestion.bucket).toEqual('sandbox');
				expect(refNoSlashQuestion.objectPath).toEqual('');
				expect(refNoSlashHash.bucket).toEqual('sandbox');
				expect(refNoSlashHash.objectPath).toEqual('');
			});

			test('Extracts the bucket and the object', () => {
				const ref = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('some/object/path');
			});

			test('Does not remove forward slashes', () => {
				const ref = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath%2F');

				expect(ref.bucket).toEqual('sandbox');
				expect(ref.objectPath).toEqual('some/object/path/');
			});

			test('Ignores anything after a ? or a #', () => {
				const hashRef = new Reference(
					'https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath#somethingHere'
				);
				const questionRef = new Reference(
					'https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath?somethingHere'
				);

				expect(hashRef.bucket).toEqual('sandbox');
				expect(hashRef.objectPath).toEqual('some/object/path');
				expect(questionRef.bucket).toEqual('sandbox');
				expect(questionRef.objectPath).toEqual('some/object/path');
			});
		});
	});

	describe('isRoot', () => {
		test('*.appspot.com', () => {
			const ref = new Reference('sandbox.appspot.com');

			expect(ref.isRoot).toEqual(true);
		});

		test('gs://', () => {
			const ref = new Reference('gs://sandbox/');
			const notRoot = new Reference('gs://sandbox/something');

			expect(ref.isRoot).toEqual(true);
			expect(notRoot.isRoot).toEqual(false);
		});

		test('http://', () => {
			const ref = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox');
			const notRoot = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath');

			expect(ref.isRoot).toEqual(true);
			expect(notRoot.isRoot).toEqual(false);
		});
	});

	describe('gsPath', () => {
		test('*.appspot.com', () => {
			const ref = new Reference('sandbox.appspot.com');

			expect(ref.gsPath).toEqual('gs://sandbox.appspot.com/');
		});

		test('gs://', () => {
			const root = new Reference('gs://sandbox/');
			const object = new Reference('gs://sandbox/some/object/path');

			expect(root.gsPath).toEqual('gs://sandbox/');
			expect(object.gsPath).toEqual('gs://sandbox/some/object/path');
		});

		test('http://', () => {
			const root = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox');
			const object = new Reference('https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath');

			expect(root.gsPath).toEqual('gs://sandbox/');
			expect(object.gsPath).toEqual('gs://sandbox/some/object/path');
		});
	});

	describe('parent', () => {
		test('throws when trying to get parent of root', () => {
			const ref = new Reference('gs://sandbox/');

			expect(() => ref.parent).toThrow(/Can't get parent of root/);
		});

		test('returns instance new Reference instance', () => {
			const ref = new Reference('gs://sandbox/some/folder/');

			expect(ref.parent instanceof Reference).toEqual(true);
			expect(ref.parent instanceof Reference).not.toBe(ref);
		});

		test('returns parent of folder', () => {
			const ref = new Reference('gs://sandbox/some/folder/');

			expect(ref.parent.objectPath).toEqual('some/');
		});

		test('returns parent of file', () => {
			const ref = new Reference('gs://sandbox/some/file');

			expect(ref.parent.objectPath).toEqual('some/');
		});

		test('returns correct parent when chained', () => {
			const ref = new Reference('gs://sandbox/some/sub/folder/or/file');

			expect(ref.parent.parent.parent.objectPath).toEqual('some/sub/');
			expect(ref.parent.parent.parent.parent.parent.isRoot).toEqual(true);
			expect(ref.parent.parent.parent.parent.parent.objectPath).toEqual('');
		});
	});

	describe('URIPath', () => {
		test('Throws on root', () => {
			const ref = new Reference('gs://sandbox');

			expect(() => ref.URIPath).toThrow(/Can't get URI path for root/);
		});

		test('Path to object', () => {
			const ref = new Reference('gs://sandbox/path/to/object');

			expect(ref.URIPath).toEqual('/b/sandbox/o/path%2Fto%2Fobject');
		});
	});

	describe('child', () => {
		test('Correctly appends path to root', () => {
			const ref = new Reference('gs://sandbox');

			expect(ref.child('sub/path').objectPath).toEqual('sub/path');
			expect(ref.child('sub/path/').objectPath).toEqual('sub/path/');
			expect(ref.child('/sub/path').objectPath).toEqual('sub/path');
		});

		test('Correctly append path to a nested object path', () => {
			const ref = new Reference('gs://sandbox/path/to/obj');

			expect(ref.child('sub/path').objectPath).toEqual('path/to/obj/sub/path');
			expect(ref.child('sub/path/').objectPath).toEqual('path/to/obj/sub/path/');
			expect(ref.child('/sub/path').objectPath).toEqual('path/to/obj/sub/path');
		});

		test('Correctly append path to a nested folder path', () => {
			const ref = new Reference('gs://sandbox/path/to/obj/');

			expect(ref.child('sub/path').objectPath).toEqual('path/to/obj/sub/path');
			expect(ref.child('sub/path/').objectPath).toEqual('path/to/obj/sub/path/');
			expect(ref.child('/sub/path').objectPath).toEqual('path/to/obj/sub/path');
		});
	});
});
