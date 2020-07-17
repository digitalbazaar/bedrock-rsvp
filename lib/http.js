/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import api from './api.js';
import bedrock from 'bedrock';
import {asyncHandler} from 'bedrock-express';
const {config} = bedrock;
import {httpClient} from '@digitalbazaar/http-client';
import brHttpsAgent from 'bedrock-https-agent';
import logger from './logger.js';
import cors from 'cors';
import {validate} from 'bedrock-validation';

const routes = {
  rsvps: '/rsvps',
  rsvp: '/rsvps/:rsvpId',
};

bedrock.events.on('bedrock-express.configure.routes', app => {
  const {host} = config.server;
  const baseRsvpUrl = `https://${host}${routes.rsvps}`;

  app.post(
    routes.rsvps,
    validate('bedrock-rsvp.document'),
    asyncHandler(async (req, res) => {
      const result = await api.createRequest(req.body);
      const response = {
        created: result.meta.created,
        ttl: result.rsvp.ttl,
        url: `${baseRsvpUrl}/${result.rsvp.id}`,
      };
      res.json(response);
    }));

  // the RSVP recipient is posting their response
  app.options(routes.rsvp, cors());
  app.post(
    routes.rsvp,
    cors(),
    // validate('bedrock-rsvp.foo'),
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;

      // handleResponse throws if a listener was not found
      const {rsvp: {listener}} = await api.handleResponse({rsvpId});
      if(listener.hostname === _getHostname() && listener.port === _getPort()) {
        // the listener is attached to this Bedrock worker, notify the listener
        await bedrock.events.emit(
          `bedrock-rsvp.rsvp-response-${rsvpId}`, req.body);
        res.json({success: true});
        return;
      }

      const baseUrl =
        `${listener.protocol}${listener.hostname}:${listener.port}`;
      const targetUrl = `${baseUrl}${req.originalUrl}`;
      logger.debug('attempting to proxy a response to another host', {
        rsvpId, targetUrl
      });
      const {agent} = brHttpsAgent;
      let result;
      try {
        result = await httpClient.post(targetUrl, {agent, json: req.body});
      } catch(e) {
        logger.error('the proxy attempt failed', {
          error: e, rsvpId, targetUrl
        });
        // some types of errors will not have status or data
        // details of unexpected errors should not be surfaced to the public
        return res.status(e.status || 500).json(e.data || {
          name: 'UnknownError',
          message: 'An internal server error occurred.'
        });
      }
      res.json(result.data);
    }));

  app.get(
    routes.rsvp,
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;

      // mandatory headers and http status to keep connection open
      const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache'
      };

      // register the location/hostname for this listener
      const {rsvp} = await api.registerResponseListener({
        rsvpId,
        listener: {
          hostname: _getHostname(),
          port: _getPort(),
          // This service may be bound to HTTP only behind an ingress service.
          // A peer that needs to proxy an incoming request will direct the
          // request directly to this service behind any ingress service using
          // the appropriate protocol.
          // It is assumed that if this server is operating in httpOnly mode
          // that its peers will be doing likewise.
          protocol: config.express.httpOnly ? 'http://' : 'https://',
        }
      });

      // initiate the EventSource event stream
      res.writeHead(200, headers);

      const expireTimer = setTimeout(() => {
        logger.debug('terminating expired listener', {rsvp});
        // construct an EventSource event
        // FIXME: what does a LD error look like? A successful response is
        // in the ActivityStream context.
        const event = {
          '@context': 'urn:someContext',
          type: 'Error',
          message: 'The RSVP has expired.',
          rsvpId,
        };
        res.write(_composeEventSourceEvent({event}));
        res.end();
      }, rsvp.remainingTtl);

      const eventName = `bedrock-rsvp.rsvp-response-${rsvpId}`;
      bedrock.events.on(eventName, async event => {
        clearTimeout(expireTimer);
        res.write(_composeEventSourceEvent({event}));
        res.end();
      });

      // The request is removed when the connection is closed.
      // This will happen after the response is successfully delivered.
      // This will also happen if the connection is lost prematurely.
      // In this case, the easiest way to ensure that the response is delivered
      // is to restart the process by creating a new request
      req.on('close', async () => {
        clearTimeout(expireTimer);
        // remove the listener for this rsvpId
        bedrock.events.removeAllListeners(eventName);
        // remove the request from the database
        await api.removeRequest({rsvpId, throwErrors: false});
      });
    }));
});

function _composeEventSourceEvent({event}) {
  // construct an EventSource event
  return `data: ${JSON.stringify(event)}\n\n`;
}

function _getHostname() {
  // virtualHostname is used to communicate a unique IP or hostname associated
  // with this express endpoint so that in can be distinguished from other
  // endpoints in virtual deployment environments
  return config.rsvp.virtualHostname || config.server.domain;
}

function _getPort() {
  // virtualPort is used to communicate the port associated
  // with this express endpoint
  const bedrockPort = config.express.httpOnly ?
    config.server.httpPort : config.server.port;
  return config.rsvp.virtualPort || bedrockPort;
}
