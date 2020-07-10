/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brHttpsAgent = require('bedrock-https-agent');
const {config, util: {clone, delay}} = require('bedrock');
const helpers = require('./helpers');
const {httpClient} = require('@digitalbazaar/http-client');
const mockData = require('./mock-data');
const {registerResponseListener} = require('bedrock-rsvp');
const nock = require('nock');

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
        const {agent} = brHttpsAgent;
        result = await httpClient.post(root, {agent, json: payload});
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
    it('listens for an RSVP response', async () => {
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

  describe('proxied rsvp response', () => {
    const requests = [];
    before(async () => {
      for(let i = 0; i < 2; ++i) {
        const request = await helpers.createRsvp({url: root});
        requests.push(request);
        const {url} = request;
        const rsvpId = url.substr(url.lastIndexOf('/') + 1);
        if(i === 1) {
          _nockRsvp({rsvpId, error: true});
        } else {
          _nockRsvp({rsvpId});
        }
        // register a mock listener registered on a mock endpoint
        const listener = {
          // although nock is handling this request, `host` must be a valid
          // DNS hostname
          hostname: 'example.com',
          port: 443,
          protocol: 'https://',
        };
        let err;
        try {
          await registerResponseListener({rsvpId, listener});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
      }
    });
    it('successfully proxies a request to another hostname', async () => {
      // get the RSVP URL from the request
      const {url} = requests[0];
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
    });
    it('proxies an error from the target properly', async () => {
      // get the RSVP URL from the request
      const {url} = requests[1];
      const rsvpResponse = clone(mockData.rsvpResponses.alpha);
      let result;
      let err;
      try {
        const {agent} = brHttpsAgent;
        result = await httpClient.post(url, {agent, json: rsvpResponse});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.status.should.equal(400);
      should.exist(err.data);
      err.data.should.be.an('object');
      err.data.should.eql({
        name: 'InvalidStateError',
        message: 'Invalid state error.'
      });
    });
  });

  describe('rsvp endpoint', () => {
    let request;
    before(async () => {
      (request = await helpers.createRsvp({url: root}));
    });
    it('responds with InvalidStateError on listener not found', async () => {
      let result;
      let err;
      const {url} = request;
      const payload = {
        url: 'https://example.com/3252335',
      };
      try {
        const {agent} = brHttpsAgent;
        result = await httpClient.post(url, {agent, json: payload});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.status.should.equal(400);
      should.exist(err.data);
      err.data.should.eql({
        message: 'The RSVP listener was not found.',
        type: 'InvalidStateError',
        details: {
          httpStatusCode: 400,
          rsvpId: url.substr(url.lastIndexOf('/') + 1)
        },
        cause: null
      });
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
        const {agent} = brHttpsAgent;
        result = await httpClient.post(url, {agent, json: payload});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.status.should.equal(404);
      should.exist(err.data);
      const {data} = err;
      data.should.be.an('object');
      data.type.should.equal('NotFoundError');
      data.details.rsvpId.should.equal(url.substr(url.lastIndexOf('/') + 1));
    });
  }); // end rsvp endpoint
});

function _nockRsvp({error = false, rsvpId}) {
  nock('https://example.com')
    .post(`/rsvps/${rsvpId}`)
    // eslint-disable-next-line no-unused-vars
    .reply((uri, requestBody) => {
      if(error) {
        return [
          400,
          {
            name: 'InvalidStateError',
            message: 'Invalid state error.',
          }
        ];
      }
      return [
        200,
        {success: true}
      ];
    });
}
