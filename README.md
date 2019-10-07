# Firebase storage lite(WIP)
The Official Firebase SDKs for Javascript are too big and can make it very hard for developers to achieve standard loading times, and if you are like me and strive to provide the best performance for you users, its imposible to provide good loading times for smartphones over 3G networks due to its big size and over complicated code.

It took it upon myself to provide an alternative SDK for when bad performance is just not an option.
I'm currently working on libraries for Firestore, Auth and Storage(this one).

The main goal of these libraries is to be as lean as possible, and provide close to full functionality, but if it comes at the cost of performance or size, I will most likely choose to stick to lower level functionality that you will need to extend if you need more.
One example for that will be IE11 and browsers that dont support ES5. I wont try to support them because they require heavy pollyfils, and are dying anyways.

## Is performance in the official JS SDK really that bad?
Short answer: yes.
But the full answer is, that it depends on you project.
If you want to know more details, please read my post on the Firebase google group:
https://groups.google.com/forum/#!topic/firebase-talk/F0NenvOEYrE

## Does this lib provide full functionality.
Yes it does, as opposed to my other Firebase libs.
The API is not the same, its a little bit smaller, and we don't 'glue' everithing together for you if you try to work with Auth of Firestore. But its easy enought that it doesnt matter.

One thing to consider is that we return the raw data from the Storage API, So many times you will receive a `String` instead of `Numbers` when requesting metadata, and it is your responsability to convert it when neccesary.

Another thing to consider is that offline functionality is currently missing. I plan to add it in the future, but if you want to do it yourself it shouldn't be that hard because of the way I structured the library.

## How to install and use.
Before using it please note that its still work in progress, **and error handling is not quite done yet**. However I do follow(most of the time) semantic versioning so you should be fine.

```
npm install firebase-storage-lite
```

```
yarn add firebase-storage-lite
```

### Instantiate a reference.
```javascript
import Reference from 'firestore-storage-lite';
import config from 'firestoreConfig.js';

// Create a reference to a bucket or a file.
// You can just pass the `storageBucket` prop from the `firebaseConfig`,
// A `gs://` path or an http url like https://firebasestorage.googleapis.com/v0/b/sandbox/o/some%2Fobject%2Fpath.
// Note that the http url must be one to https://firebasestorage.googleapis.com.

// firebase config example:
const bucket = new Reference(config.storageBucket);
// gs:// path example:
const bucket = new Reference('gs://my-bucket'); // root bucket
const object = new Reference('gs://my-bucket/object/path'); // reference to an object
```

### Reference's API
- `isRoot` Returns a `Boolean`. True if the reference point to the root of the bucket.
- `gsPath` Should be considered private, and your code shoulden't depend on it.
- `URIPath` Should be considered private, and your code shoulden't depend on it.
- `root` Returns a new `Reference` instance pointing root of the bucket.
- `parent` Returns a new `Reference` instance pointing to the parent object/dir. Throws when called on a root reference.
- `child(path)` Receives a string path relative to the Reference and Returns a new `Reference` pointing to that object/dir.
- `put(blob, metadata)` Recives as arguments a `Blob` and a metadata `Object`. Returns a `UploadTask`(see info below)
- `delete()` Returns a `Promise` to delete the object from the bucket.
- `list()` Returns a `Promise` that evaluates to the returned parsed JSON response. A list of object with the prefix equal to this object/dir path in their name.
- `getMetadata()` Returns a `Promise` that evaluates to the metadata for this object.
- `updateMetadata(metadata)` Receives a metadata `Object` to merge into the exsisting metadata. Returns a `Promise` that evaluates to the updated metadata.
- `getDownloadURL()` Returns a `Promise` that evaluates to a download URL for this object.

### UploadTask's API
(WIP)
