/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import bedrock from 'bedrock';
import database from 'bedrock-mongodb';
import {promisify} from 'util';

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(['rsvp']);

  await promisify(database.createIndexes)([{
    collection: 'rsvp',
    fields: {'rsvp.id': 1},
    options: {unique: true, background: false}
  }]);
});
