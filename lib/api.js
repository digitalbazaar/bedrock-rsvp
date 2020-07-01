/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import database from 'bedrock-mongodb';
import {IdGenerator, IdEncoder} from 'bnid';
import bedrock from 'bedrock';
const {util: {BedrockError}} = bedrock;

const generator = new IdGenerator({bitLength: 128});
const encoder = new IdEncoder({
  encoding: 'base58',
  fixedLength: true,
  multibase: false
});

export const createRequest = async ({ttl, type} = {}) => {
  const id = encoder.encode(await generator.generate());
  const now = Date.now();
  const document = {
    meta: {
      created: now,
      updated: now,
    },
    rsvp: {
      id,
      ttl,
      type,
    }
  };
  try {
    await database.collections.rsvp.insertOne(document, database.writeOptions);
  } catch(e) {
    throw new BedrockError('An unknown error occurred.', 'UnknownError', {
      httpStatusCode: 400,
      public: true,
    }, e);
  }
  return document;
};

// register that the host is waiting for an RSVP response on a particular host
export const handleHostListener = async ({rsvpId, domain}) => {
  const query = {
    'rsvp.id': rsvpId,
  };
  const update = {
    $set: {'rsvp.domain': domain},
  };
  const collection = database.collections.rsvp;
  let result;
  try {
    result = await collection.updateOne(query, update, database.writeOptions);
  } catch(e) {
    throw new BedrockError('An unknown error occurred.', 'UnknownError', {
      httpStatusCode: 400,
      public: true,
    }, e);
  }
  if(result.result.n === 0) {
    throw new BedrockError('Unknown RSVP ID.', 'NotFoundError', {
      httpStatusCode: 404,
      public: true,
    });
  }
};

export const handleResponse = async ({rsvpId}) => {
  let record;
  try {
    record = await database.collections.rsvp.findOne({
      'rsvp.id': rsvpId,
    }, {
      projection: {
        _id: 0,
      }
    });
  } catch(e) {
    throw new BedrockError('An unknown error occurred.', 'UnknownError', {
      httpStatusCode: 400,
      public: true,
    }, e);
  }
  if(!record) {
    throw new BedrockError('RSVP not found.', 'NotFoundError', {
      httpStatusCode: 404,
      public: true,
      rsvpId,
    });
  }
  return {success: true};
};

export default {
  createRequest,
  handleHostListener,
  handleResponse,
};
