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

const routes = {
  rsvps: '/rsvps',
  rsvp: '/rsvps/:rsvpId',
};

bedrock.events.on('bedrock-express.configure.routes', app => {
  const {baseUri} = config.server;
  const baseRsvpUrl = `${baseUri}${routes.rsvps}`;

  app.post(
    routes.rsvps,
    // validate('bedrock-rsvp.foo'),
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
  app.post(
    routes.rsvp,
    // validate('bedrock-rsvp.foo'),
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;

      // handleResponse throws if a listener was not found
      const {rsvp: {listener}} = await api.handleResponse({rsvpId});

      const {server: {domain}} = config;
      const port = config.express.httpOnly ?
        config.server.httpPort : config.server.port;
      if(listener.domain === domain && listener.port === port) {
        // the listener is attached to this Bedrock worker, notify the listener
        await bedrock.events.emit(
          `bedrock-rsvp.rsvp-response-${rsvpId}`, req.body);
        res.json({success: true});
        return;
      }

      const baseUrl = `${listener.protocol}${listener.domain}:${listener.port}`;
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

      // register the location/domain for this listener
      await api.registerResponseListener({
        rsvpId,
        listener: {
          domain: config.server.domain,
          port: config.server.port,
          // This service may be bound to HTTP only behind an ingress service.
          // A peer that needs to proxy an incoming request will direct the
          // request directly to this service behind any ingress service using
          // the appropriate protocol.
          protocol: config.express.httpOnly ? 'http://' : 'https://',
        }
      });

      // initiate the EventSource event stream
      res.writeHead(200, headers);

      const eventName = `bedrock-rsvp.rsvp-response-${rsvpId}`;
      bedrock.events.on(eventName, async event => {
        // construct an EventSource event
        const evenSourceEvent = `data: ${JSON.stringify(event)}\n\n`;
        res.write(evenSourceEvent);
        res.end();
      });

      // The request is removed when the connection is closed.
      // This will happen after the response is successfully delivered.
      // This will also happen if the connection is lost prematurely.
      // In this case, the easiest way to ensure that the response is delivered
      // is to restart the process by creating a new request
      req.on('close', async () => {
        // remove the request from the database
        await api.removeRequest({rsvpId, throwErrors: false});
        // remove the listener for this rsvpId
        bedrock.events.removeAllListeners(eventName);
      });
    }));
});
