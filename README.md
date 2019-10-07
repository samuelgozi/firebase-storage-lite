# Firebase storage lite(WIP)

The Official Firebase SDKs for Javascript are too big and can make it very hard for developers to achieve standard loading times, and if you are like me and strive to provide the best performance for you users, its impossible to provide good loading times for smartphones over 3G networks due to its big size and over complicated code.

It took it upon myself to provide an alternative SDK for when bad performance is just not an option.
I'm currently working on libraries for Firestore, Auth and Storage(this one).

The main goal of these libraries is to be as lean as possible, and provide close to full functionality, but if it comes at the cost of performance or size, I will most likely choose to stick to lower level functionality that you will need to extend if you need more.
One example for that will be IE11 and browsers that don't support ES5. I wont try to support them because they require heavy pollyfils, and are dying anyways.

## Whats the difference between this and the official SKD?

The official Storage SDK weights about 11.7KB(minified + gzipped), but if you want to use it you have to also use its companion `@firebase/app` which weights about 9KB(minified + gzipped). Together they add up to about **20.7KB**(minified + gzipped).

This library weights **1.5KB**(minified + gzipped). It offers the same functionality with a slightly different API, and you can use it just by itself. Another difference is the way we handle Auth, our way its much more flexible, and pretty easy to integrate with.

One thing to consider is that we return the raw data from the Storage API, that means that the metadata we return wasn't converted into correct types, so `Number`s will most likely be `String`s. It might change in the future if it turns out to be a pain to deal with.

Another thing to consider is that offline functionality is currently missing. I plan to add it in the future, but if you want to do it yourself it shouldn't be that hard because of the way I structured the library.

## Is performance in the official JS SDK really that bad?

Short answer: yes.
But the full answer is, that it depends on you project.
If you want to know more details, please read my post on the Firebase google group:
https://groups.google.com/forum/#!topic/firebase-talk/F0NenvOEYrE

## How to install and use.

Before using it please note that its still work in progress, **and error handling is not quite done yet**. However I do follow semantic versioning so you should be fine.

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

# Full API Reference

Please note that any property or method that is not documented here should be considered as private.

## Reference() constructor

`Reference` is the class that is exported by the library. With it you create a reference to an object or any "directory" in a bucket.

### Arguments

`Reference(path: string, auth: Object): Reference`

- **path:** `String` - can be a `gs://` path, the name of a default firebase bucket(must end with `appspot.com`) or a `https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[objectPath]` url.
- **auth:**`Object` - An object with the property `authorizeRequest()` that should be a function that receives a native `Request` object, and adds necessary headers in order to authorize it. In the next version of `firebase-auth-lite` it will be possible to pass an instance of it here.

### Returns

An instance of `Reference`.

## Reference(instance).**bucket**

`String` - The name of the bucket.

## Reference(instance).**objectPath**

`String` - The full path to the object within the bucket.

## Reference(instance).**isRoot**

`Boolean` - True if the reference point to the root of the bucket.

## Reference(instance).**isRoot**

`Boolean` - True if the reference point to the root of the bucket.

## Reference(instance).**root**

`Reference` - Instance pointing to the root of the bucket.

**Throws when called on a root reference.**

## Reference(instance).**parent**

`Reference` - Instance pointing to the parent dir of this reference.

## Reference(instance).**child()**

Function that returns a new `Reference` to a child of this dir.

### Arguments

`ref.child(path: string): Reference`

- **path:**`String` - A path relative to this dir/object.

### Returns

An instance of `Reference` pointing to the provided child.

## Reference(instance).**put()**

Uploads a blob to the referenced object.

### Arguments

`ref.put(blob: string, metadata?: Object): UploadTask`

- **blob:**`Blob` - The blob to upload.
- **[optional]** **metadata:**`Object` - An object with metadata to add to the uploaded object.

### Returns

An [`UploadTask`](<#UploadTask(instance)>) instance that is used to perform the upload and get updates on the progress.

## Reference(instance).**delete()**

Deletes an object from the bucket.

### Returns

A `promise` that resolves if the object was deleted.

## Reference(instance).**list()**

List items (files) and prefixes (folders) under this storage reference.
List API is only available for Firebase Rules Version 2.

Please note that there are not real directories in Storage.
Please read [How Subdirectories Work In Cloud Storage](https://cloud.google.com/storage/docs/gsutil/addlhelp/HowSubdirectoriesWork).

### Returns

A `Promise` that resolves to the list of objects found.

## Reference(instance).**getMetadata()**

Returns an object of the metadata for the referenced object.

### Returns

A `promise` that resolves to the metadata object.

## Reference(instance).**updateMetadata()**

Returns an object of the metadata for the referenced object.

### Arguments

`ref.updateMetadata(metadata: Object): Promise`

- **metadata:**`Object` - The new metadata to update. Please note that only the provided properties will be changed, all the rest will not be touched.

### Returns

A `promise` that resolves to the updated metadata object.

## Reference(instance).**getDownloadURL()**

Download URL that can be used to view or download the asset.

### Returns

A `Promise` that evaluates to a download URL for this object.

## UploadTask(instance)

An object that represents an upload task.
Unlike the name, the API is not the same as Firebases one.

**Currently there is only one method that you should use in your code, and its the one documented here. In the future another one will be added to attach event listeners for upload progress**

## UploadTask(instance).**start()**

Start the Upload process.

### Returns

A `Promise` that resolves when the upload is complete, and returns the metadata of the newly uploaded object.
