/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import database from 'bedrock-mongodb';
import {IdGenerator, IdEncoder} from 'bnid';
import bedrock from 'bedrock';
const {util: {BedrockError}} = bedrock;

// 64 bit random id generator
const generator = new IdGenerator({bitLength: 128});
// base58, multibase, fixed-length encoder
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
  handleResponse,
};
