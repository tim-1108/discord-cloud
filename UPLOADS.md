# Uploads

`discord-cloud` schedules uploads on multiple different services to allow for concurrent and thus faster uploads.

### Booking upload services

Before requesting an upload from the manager, you need to "book" yourself a certain amount of upload services, meaning they will be assigned to you and only you can use them. The client is responsible to know when it should ask for the next upload.

For booking, use the `UploadBookingRequestPacket` with a certain `desired_amount` of services to assign to your client. The server will return a `UploadBookingPacket` with a `amount` of how many services you have actually been assigned now. This is the amount you now have, nothing more, nothing less. The server is aware of your `desired_amount`, but may not have been able to fulfill it initially.

However, when other services log on or get freed, you will receive a `UploadBookingModifyPacket` with a field of `effective_change`, which is always either `-1` or `1`. If the value is negative, one of your servicess likely disconnected whilst you had it booked. If you had an upload running on it, you will receive a `UploadFinishInfoPacket` notifying you it failed. Then just know that you can request one upload less at a time. If the value is positive, you can immediately request a new upload.

### The queue

The client is fully responsible for having a queue of files to upload. It has to request uploads only when it knows that upload services it has booked are free. Otherwise, these uploads will be rejected, for the client to try again.

### Requesting an upload

Great, with upload services secured for you, you may now request to start an upload. For this, send a `UploadRequestPacket` with the metadata of the file. The `size` field is binding, as the service will not accept anything with different sizes.

The server will reply to you with a `UploadResponsePacket`, wherin the boolean field `accepted` is essential. If this is `false`, all other fields except for `rejection_reason` will be meaningless. This field will tell you what you might have done incorrectly or whether there is some error on the server.

Now, if `accepted` is true, you can read the important fields. Although they may be marked as possibly being `undefined`, they are only such when `accepted` is `false`. The `upload_address` contains the HTTP URL of the service you can now send to. You should use this URL directly, without any pathname or other modifications.

The `chunk_size` tells you how large your individual chunks should be, more on that later, but this number is very important. The `upload_id` is a UUID that identifies your current job to both the manager and the upload service.

### Sending chunks

As Discord only allows for 10MB of attachments per messsage, we also transmit these chunks individually to the service. The `chunk_size` field you received will be somewhat below this 10MB threshold.

For sending your first chunk, you now have to read the first `chunk_size` bytes from your file. When working with JavaScript in the DOM, the frontend already contains a `streamFromFile` composable, which always returns the next buffer with the exact chunk size specified from an internal file stream.

Once you have your data buffer for any chunk, open a POST request to the `upload_address` specified by the server. This comes in the form of a `multipart/form-data` request with the following fields:

- `id`: the `upload_id` field from above, used to identify this upload job
- `chunk`: the "index" of the chunk this is, starting from 0
- `file`: the actual data buffer, wherin the `filename` does not matter

The client is responsible for knowing which chunks it has already uploaded or how many it has to. However, chunks can be uploaded in any order. The upload service will determine when the upload is done.

If encryption is enabled on the service, it will encrypt the whole chunk individually before sending it to Discord. The client will never receive still encrypted data.

There is also a time limit for transferring chunks (likely three minutes), after which the upload service will cancel the job if no chunks have been received in that time. This timer is reset with every sent chunk.

If a chunk has been uploaded successfully, a `200 OK` status code is returned, otherwise the status will be depending on the error, with a `application/json` body being available, containing an `error` string field with some information. The client is free to retry as many times as possible.

### Finishing the upload

Once the upload service detects that all chunks have been uploaded and transferred to Discord, it will notify the manager, which will then save the file to Supabase.

At this point, a `UploadStageFinishPacket` with the `upload_id` as an identifier is sent to the client. This means that the upload stage of the job is now done and the service is free to handle a new upload which may be requested via the `UploadRequestPacket`.

The upload may still fail, and should not be marked as resolved yet. If the file already exists, a `UploadOverwriteRequestPacket` will be sent to the client. It does not have to answer immediately, but can send a `UploadOverwriteResponsePacket` with a chosen `action` of either `overwrite`, `rename` or `skip`. If the field `use_on_all_uploads` is set to `true`, the server will not bother the client with any more overwrite requests until the booking is cleared. All other queued up overwrite requests on the client should also be understood as resolved by this.

Until the overwrite request is answered, the file will be in a limbo, having not yet been saved to the database. If the client disconnects, the file is lost.

Now, a `UploadFinishInfoPacket` is sent to the client. If `success` is false, the upload failed. Then, the `reason` string field can be used for insight. This may also happen at any time within the upload job, if something has gone wrong.

If `success` is true though, the upload job is now officially done. An optional `rename_target` field also exists, if `rename` was specified in the overwrite response. A `FileModifyPacket` is broadcast to all clients, informing them that the file was added.

### Clearing the booking

Once the client has received the last `UploadStageFinishPacket`, with all having succeeded and it having emptied its queue, it is expected to send a `UploadBookingClearPacket` to free its booking and let the manager reclaim these services for other clients. If this is not possible because there are still uploads running, a `GenericBooleanPacket` with `false` will notify the client of such. It has to try again later.

The client does not need to wait until the last `UploadFinishInfoPacket` has been sent, as the upload service is already done on stage finish.
