/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const axios = require('axios');
const brHttpsAgent = require('bedrock-https-agent');
const {config, util: {clone, delay}} = require('bedrock');
const helpers = require('./helpers');
const {httpClient} = require('@digitalbazaar/http-client');
const mockData = require('./mock-data');

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
        const {httpsAgent} = brHttpsAgent;
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

  describe('rsvp host listener', () => {
    let request;
    before(async () => {
      (request = await helpers.createRsvp({url: root}));
    });

    // This test uses HTTP.GET instead of the EventSource API which is used
    // in a browser. This works fine provided there is only on message
    // passed in the stream as with the use case here.
    it.only('listens for an RSVP response', async () => {
      // get the RSVP URL from the request
      const {url} = request;

      let err;
      let testResult;
      try {
        testResult = await Promise.all([
          // setup a listener for the RSVP
          (async () => {
            let result;
            let err;
            try {
              const {agent} = brHttpsAgent;
              result = await httpClient.get(url, {agent});
            } catch(e) {
              err = e;
            }
            assertNoError(err);
            const response = await result.text();
            const responseJson = JSON.parse(
              response.substr(response.indexOf('{')));
            should.exist(responseJson);
            responseJson.should.have.keys([
              '@context',
              'type',
              'summary',
              'actor',
              'object',
            ]);
            responseJson.should.eql(mockData.rsvpResponses.alpha);
            return true;
          })(),
          // make an RSVP response
          (async () => {
            // allow time for the listener to register itself
            await delay(200);

            const rsvpResponse = clone(mockData.rsvpResponses.alpha);
            let result;
            let err;
            try {
              const {agent} = brHttpsAgent;
              result = await httpClient.post(url, {agent, json: rsvpResponse});
            } catch(e) {
              err = e;
            }
            assertNoError(err);
            const {data} = result;
            data.success.should.be.true;
            return true;
          })()
        ]);
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(testResult);
      testResult.every(r => r).should.be.true;
    });
  }); // end rsvp host listener

  describe('rsvp endpoint', () => {
    let request;
    before(async () => {
      (request = await helpers.createRsvp({url: root}));
    });
    it('sends a response to the rsvp endpoint', async () => {
      let result;
      let err;
      const {url} = request;
      const payload = {
        url: 'https://example.com/3252335',
      };
      try {
        const {httpsAgent} = brHttpsAgent;
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
        const {httpsAgent} = brHttpsAgent;
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
