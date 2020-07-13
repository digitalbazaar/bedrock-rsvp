/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import database from 'bedrock-mongodb';
import {IdGenerator, IdEncoder} from 'bnid';
import bedrock from 'bedrock';
const {config} = bedrock;
const {util: {BedrockError}} = bedrock;
import logger from './logger.js';

bedrock.events.on('bedrock.init', () => {
  if(config.core.workers !== 1) {
    throw new BedrockError(
      'The "bedrock-rsvp" may only be used when "bedrock.core.workers === 1".',
      'InvalidStateError');
  }
});

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

  const {rsvp} = record;
  if(!rsvp.listener) {
    throw new BedrockError(
      'The RSVP listener was not found.', 'InvalidStateError', {
        httpStatusCode: 400,
        public: true,
        rsvpId,
      });
  }

  return {rsvp};
};

// register that the host is waiting for an RSVP response on a particular host
export const registerResponseListener = async ({rsvpId, listener}) => {
  const query = {'rsvp.id': rsvpId};
  const update = {$set: {'rsvp.listener': listener}};
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

// when used inside of event listeners pass throwErrors parameter to avoid
// unhandled errors
export const removeRequest = async ({rsvpId, throwErrors = true}) => {
  const query = {'rsvp.id': rsvpId};
  const collection = database.collections.rsvp;
  try {
    await collection.deleteOne(query);
  } catch(e) {
    if(throwErrors) {
      throw e;
    }
    logger.error('Could not delete request.', 'UnknownError', {
      public: false,
      rsvpId
    }, e);
  }
};

export default {
  createRequest,
  handleResponse,
  registerResponseListener,
  removeRequest,
};
