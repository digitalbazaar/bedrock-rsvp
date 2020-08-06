/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import bedrock from 'bedrock';
import database from 'bedrock-mongodb';
import {promisify} from 'util';
const {config} = bedrock;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(['rsvp']);

  await promisify(database.createIndexes)([{
    collection: 'rsvp',
    fields: {'rsvp.id': 1},
    options: {unique: true, background: false}
  },
  // This is a MongoDB ttl index which will automatically delete documents
  // after they have expired. Documents are typically deleted within 60 seconds
  // of their expiration. This is for housekeeping only. RSVP APIs must check
  // to ensure that RSVPs have not expired.
  {
    collection: 'rsvp',
    fields: {'rsvp.createdDate': 1},
    options: {
      expireAfterSeconds: Math.floor(config.rsvp.ttl / 1000),
    }
  }]);
});
