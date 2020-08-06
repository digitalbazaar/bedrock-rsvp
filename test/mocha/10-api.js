/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config, util: {delay}} = require('bedrock');
const brRsvp = require('bedrock-rsvp');

describe('RSVP Node API', () => {
  describe('createRequest API', () => {
    it('creates a request', async () => {
      let err;
      let result;
      try {
        result = await brRsvp.createRequest();
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.should.have.keys(['meta', 'rsvp']);
      const {meta, rsvp} = result;
      meta.should.have.keys(['created', 'updated']);
      rsvp.should.have.keys([
        'createdDate', 'id', 'ttl', 'type'
      ]);
    });
  });
  describe('Checks for expired RSVPs', () => {
    let rsvpId;
    beforeEach(async () => {
      const ttlSave = config.rsvp.ttl;
      // this will create an RSVP with a very short ttl
      config.rsvp.ttl = 500;
      ({rsvp: {id: rsvpId}} = await brRsvp.createRequest({type: 'someType'}));
      config.rsvp.ttl = ttlSave;
    });
    it('handleResponse API checks for expired RSVPs', async () => {
      await delay(600);
      let result;
      let err;
      try {
        result = await brRsvp.handleResponse({rsvpId});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      // the API may report an InvalidStateError because the RSVP has expired
      // but there is also the possiblity that the MongoDB has deleted the
      // RSVP by way of the ttl index
      ['NotFoundError', 'InvalidStateError'].includes(err.name).should.be.true;
    });

    it('registerResponseListener API checks for expired RSVPs', async () => {
      await delay(600);
      let result;
      let err;
      try {
        result = await brRsvp.registerResponseListener({
          rsvpId,
          listener: 'localhost'
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      // the API may report an InvalidStateError because the RSVP has expired
      // but there is also the possiblity that the MongoDB has deleted the
      // RSVP by way of the ttl index
      ['NotFoundError', 'InvalidStateError'].includes(err.name).should.be.true;
    });
  });
});
