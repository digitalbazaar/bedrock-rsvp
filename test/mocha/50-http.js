/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const axios = require('axios');
const {httpsAgent} = require('bedrock-https-agent');
const {config} = require('bedrock');

const {baseUri} = config.server;
const root = `${baseUri}/rsvps`;

describe('RSVP HTTP API', () => {
  before(async () => {
  });
  describe('rsvps endpoint', () => {
    it('creates a request', async () => {
      let result;
      let err;
      const payload = {
        // 5 minutes
        ttl: 300000,
        type: 'someType',
      };
      try {
        result = await axios.post(root, payload, {httpsAgent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result.data);
      const {data: response} = result;
      response.should.be.an('object');
      response.should.have.keys(['created', 'url', 'ttl']);
      response.created.should.be.a('number');
      response.url.should.be.a('string');
      response.ttl.should.be.a('number');
    });
  }); // end rsvps endpoint

  describe('rsvp endpoint', () => {
    let request;
    before(async () => {
      const payload = {
        // 5 minutes
        ttl: 300000,
        type: 'someType',
      };
      ({data: request} = await axios.post(root, payload, {httpsAgent}));
    });
    it('sends a response to the rsvp endpoint', async () => {
      let result;
      let err;
      const {url} = request;
      const payload = {
        url: 'https://example.com/3252335',
      };
      try {
        result = await axios.post(url, payload, {httpsAgent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
    });
    it('responds with 404 on unknown rsvpId', async () => {
      let result;
      let err;
      let {url} = request;
      // append additional characters to the good URL to change the rsvpId
      url = `${url}-unknown-id`;
      const payload = {
        url: 'https://example.com/3252335',
      };
      try {
        result = await axios.post(url, payload, {httpsAgent});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.response.status.should.equal(404);
      should.exist(err.response.data);
      const {response: {data}} = err;
      data.should.be.an('object');
      data.type.should.equal('NotFoundError');
      data.details.rsvpId.should.equal(url.substr(url.lastIndexOf('/') + 1));
    });
  }); // end rsvp endpoint
});
